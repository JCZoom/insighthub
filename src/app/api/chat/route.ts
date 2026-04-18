import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import type { DashboardSchema } from '@/types';
import { withRateLimit, chatRateLimiter } from '@/lib/rate-limiter';
import { getCurrentUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { z } from 'zod';

interface YamlGlossaryEntry {
  term: string;
  category: string;
  definition: string;
  formula?: string;
}

// Input validation schemas
const ConversationHistoryItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1, 'Message content cannot be empty').max(10000, 'Message content cannot exceed 10,000 characters')
});

const ChatRequestSchema = z.object({
  message: z.string()
    .min(1, 'Message is required')
    .max(10000, 'Message cannot exceed 10,000 characters'),
  currentSchema: z.record(z.string(), z.unknown()).nullable().optional(),
  conversationHistory: z.array(ConversationHistoryItemSchema)
    .max(20, 'Conversation history cannot exceed 20 entries')
    .optional()
    .default([]),
  sessionId: z.string()
    .uuid('Session ID must be a valid UUID')
    .optional(),
  dashboardId: z.string()
    .uuid('Dashboard ID must be a valid UUID')
    .optional(),
  stream: z.boolean()
    .optional()
    .default(false)
});

/**
 * Load glossary from the canonical YAML file so the AI prompt and the
 * glossary page always agree. Falls back to an empty array on error
 * rather than crashing the chat endpoint.
 */
function loadGlossaryForPrompt(): { term: string; category: string; definition: string; formula: string | null }[] {
  try {
    const filePath = path.join(process.cwd(), 'glossary', 'terms.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    const entries = YAML.parse(content) as YamlGlossaryEntry[];
    if (!Array.isArray(entries)) return [];
    return entries.map(e => ({
      term: e.term,
      category: e.category,
      definition: e.definition,
      formula: e.formula ?? null,
    }));
  } catch (error) {
    console.error('Failed to load glossary for AI prompt:', error);
    return [];
  }
}

// SSE helper function to format Server-Sent Events messages
function formatSSE(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Parse AI response text into structured format, handling both SQL and dashboard modes
 */
function parseAIResponse(rawText: string, isSqlMode: boolean): {
  explanation: string;
  patches?: unknown[];
  quickActions?: unknown[];
  sql?: string;
  sqlType?: string;
} {
  if (isSqlMode) {
    // For SQL mode, handle different response formats
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
      const jsonStr = jsonMatch[1]?.trim();

      if (jsonStr) {
        return JSON.parse(jsonStr);
      } else {
        // Extract SQL from code blocks if present
        const sqlMatch = rawText.match(/```sql\s*([\s\S]*?)```/);
        const sql = sqlMatch ? sqlMatch[1].trim() : null;

        return {
          explanation: rawText.replace(/```sql[\s\S]*?```/g, '').trim() || 'Here\'s your SQL query:',
          patches: [],
          quickActions: sql ? [
            { label: 'Run in Snowflake', prompt: 'Copy this query to your Snowflake worksheet' },
            { label: 'Add to Dashboard', prompt: 'Create a widget from this query' },
            { label: 'Explain Query', prompt: 'Explain what this query does step by step' }
          ] : [],
          sql: sql || undefined,
          sqlType: sql ? 'generated' : undefined
        };
      }
    } catch {
      // Fallback for SQL mode
      const sqlMatch = rawText.match(/```sql\s*([\s\S]*?)```/);
      const sql = sqlMatch ? sqlMatch[1].trim() : null;

      return {
        explanation: rawText.replace(/```sql[\s\S]*?```/g, '').trim() || 'I can help you with SQL queries and optimization.',
        patches: [],
        quickActions: sql ? [
          { label: 'Run in Snowflake', prompt: 'Copy this query to your Snowflake worksheet' },
          { label: 'Add to Dashboard', prompt: 'Create a widget from this query' }
        ] : [],
        sql: sql || undefined,
        sqlType: sql ? 'explained' : undefined
      };
    }
  } else {
    // Regular dashboard mode
    try {
      // Try to extract JSON from the response (Claude sometimes wraps in markdown code blocks)
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
      const jsonStr = jsonMatch[1]?.trim() || rawText.trim();
      return JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, treat the whole response as an explanation with no patches
      return {
        explanation: rawText || 'I understood your request but had trouble generating the schema. Could you try rephrasing?',
        patches: [],
        quickActions: [],
      };
    }
  }
}

// Process real streaming response from Anthropic
async function* processRealStream(
  stream: any,
  isSqlMode: boolean
): AsyncGenerator<{ event: string; data: any }> {
  let accumulatedText = '';
  let progress = 0;

  yield { event: 'progress', data: { message: 'Starting response stream...', progress: 5 } };

  try {
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        accumulatedText += chunk.delta.text;
        progress = Math.min(progress + 2, 85); // Gradually increase progress

        // Send token-level streaming updates
        yield {
          event: 'token',
          data: {
            text: chunk.delta.text,
            progress
          }
        };
      } else if (chunk.type === 'message_start') {
        yield { event: 'progress', data: { message: 'Response started...', progress: 10 } };
      } else if (chunk.type === 'content_block_start') {
        const message = isSqlMode ? 'Generating SQL...' : 'Building dashboard schema...';
        yield { event: 'progress', data: { message, progress: 20 } };
      }
    }

    yield { event: 'progress', data: { message: 'Processing final response...', progress: 90 } };

    // Parse the complete response
    const parsed = parseAIResponse(accumulatedText, isSqlMode);

    // Stream patches one by one if available
    if (parsed.patches && Array.isArray(parsed.patches) && parsed.patches.length > 0) {
      for (let i = 0; i < parsed.patches.length; i++) {
        const patch = parsed.patches[i];
        yield {
          event: 'patch',
          data: {
            patch,
            index: i,
            total: parsed.patches.length,
            progress: 92 + (i / parsed.patches.length) * 6
          }
        };
      }
    }

    // Send final explanation
    yield {
      event: 'explanation',
      data: {
        explanation: parsed.explanation,
        quickActions: parsed.quickActions || [],
        sql: parsed.sql || undefined,
        sqlType: parsed.sqlType || undefined,
        isSqlMode,
        progress: 100
      }
    };

  } catch (error) {
    throw error; // Re-throw to be handled by the caller
  }
}

// GET method removed for security reasons - use POST instead
// Previously this endpoint accepted sensitive data (dashboard schemas, conversation history)
// as URL query parameters, which exposed data in server logs, browser history, and proxy logs.
// All clients now use the secure POST endpoint with request body.

export async function POST(request: NextRequest) {
  return withRateLimit(request, chatRateLimiter, 'chat', async () => {
    try {
      const body = await request.json();

      // Validate request body against schema
      const validatedData = ChatRequestSchema.parse(body);

      return handleChatRequest(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        return NextResponse.json(
          { error: `Validation error: ${firstError.message}` },
          { status: 400 }
        );
      }

      console.error('POST chat API error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

// Shared chat request handler
async function handleChatRequest({
  message,
  currentSchema,
  conversationHistory = [],
  sessionId,
  dashboardId,
  stream
}: z.infer<typeof ChatRequestSchema>) {
  try {

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured. Add it to .env.local' },
        { status: 500 },
      );
    }

    const anthropic = new Anthropic({ apiKey });
    const glossaryTerms = loadGlossaryForPrompt();

    // Require authentication
    let currentUser;
    try {
      currentUser = await getCurrentUser();
    } catch (error) {
      console.warn('Failed to retrieve user session for chat API:', error);
      currentUser = null;
    }
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle chat session persistence (only if user is authenticated)
    let chatSession = null;
    if (currentUser) {
      try {
        if (sessionId) {
          // Try to get existing session
          chatSession = await prisma.chatSession.findUnique({
            where: {
              id: sessionId,
              userId: currentUser.id // Ensure user owns the session
            }
          });

          if (!chatSession) {
            console.warn(`Session ${sessionId} not found or access denied for user ${currentUser.id}`);
          }
        }

        // Create new session if none exists
        if (!chatSession) {
          chatSession = await prisma.chatSession.create({
            data: {
              userId: currentUser.id,
              dashboardId: dashboardId || null,
            }
          });
        }
      } catch (error) {
        console.error('Failed to handle chat session:', error);
        // Continue without persistence rather than fail
      }
    }

    const systemPrompt = await buildSystemPrompt(glossaryTerms, (currentSchema ?? null) as DashboardSchema | null, undefined, currentUser);

    // Save user message to database
    if (chatSession) {
      try {
        await prisma.chatMessage.create({
          data: {
            sessionId: chatSession.id,
            role: 'user',
            content: message,
          }
        });
      } catch (error) {
        console.error('Failed to save user message:', error);
      }
    }

    // Build message array: use conversation history if available, otherwise just the current message
    const messages: { role: 'user' | 'assistant'; content: string }[] =
      conversationHistory.length > 0
        ? conversationHistory
        : [{ role: 'user', content: message }];

    // Detect SQL mode - check if user message contains SQL keywords or asks for SQL help
    const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP BY', 'ORDER BY', 'INSERT', 'UPDATE', 'DELETE', 'CREATE'];
    const sqlHelpPhrases = ['explain query', 'optimize sql', 'snowflake', 'verify dashboard', 'formula help', 'natural language to sql'];

    const isSqlMode = sqlKeywords.some(keyword =>
      message.toUpperCase().includes(keyword)
    ) || sqlHelpPhrases.some(phrase =>
      message.toLowerCase().includes(phrase.toLowerCase())
    );

    // If streaming is requested, return SSE stream
    if (stream) {
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Use Anthropic streaming API for real token-by-token streaming
            const stream = await anthropic.messages.stream({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              system: systemPrompt,
              messages,
            });

            // Process real stream and forward updates
            let finalParsedData: any = null;
            let collectedPatches: any[] = [];

            for await (const chunk of processRealStream(stream, isSqlMode)) {
              if (chunk.event === 'explanation') {
                finalParsedData = chunk.data;
                // Update sessionId in the completion data
                finalParsedData.sessionId = chatSession?.id;
              } else if (chunk.event === 'patch') {
                collectedPatches.push(chunk.data.patch);
              }
              controller.enqueue(new TextEncoder().encode(formatSSE(chunk.event, chunk.data)));
            }

            // Save assistant message to database
            if (chatSession && finalParsedData) {
              try {
                const explanation = finalParsedData.explanation || '';
                const schemaChangeString = collectedPatches.length > 0
                  ? JSON.stringify(collectedPatches)
                  : null;

                await prisma.chatMessage.create({
                  data: {
                    sessionId: chatSession.id,
                    role: 'assistant',
                    content: explanation,
                    schemaChange: schemaChangeString,
                  }
                });

                // Update session timestamp
                await prisma.chatSession.update({
                  where: { id: chatSession.id },
                  data: { updatedAt: new Date() }
                });
              } catch (error) {
                console.error('Failed to save assistant message:', error);
              }
            }

            // Send final completion with sessionId
            controller.enqueue(new TextEncoder().encode(formatSSE('complete', {
              sessionId: chatSession?.id
            })));
            controller.close();
          } catch (error) {
            console.error('Streaming error:', error);
            const errorMessage = process.env.NODE_ENV === 'production'
              ? 'Internal server error'
              : (error instanceof Error ? error.message : 'Internal server error');
            controller.enqueue(new TextEncoder().encode(formatSSE('error', { error: errorMessage })));
            controller.close();
          }
        }
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Fallback to non-streaming mode for backwards compatibility
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const rawText = textBlock?.type === 'text' ? textBlock.text : '';

    // Parse the response using shared parsing logic
    const parsed = parseAIResponse(rawText, isSqlMode);

    // Save assistant message to database
    if (chatSession) {
      try {
        const schemaChangeString = parsed.patches && parsed.patches.length > 0
          ? JSON.stringify(parsed.patches)
          : null;

        await prisma.chatMessage.create({
          data: {
            sessionId: chatSession.id,
            role: 'assistant',
            content: parsed.explanation || '',
            schemaChange: schemaChangeString,
          }
        });

        // Update session timestamp
        await prisma.chatSession.update({
          where: { id: chatSession.id },
          data: { updatedAt: new Date() }
        });
      } catch (error) {
        console.error('Failed to save assistant message:', error);
      }
    }

    return NextResponse.json({
      explanation: parsed.explanation,
      patches: parsed.patches || [],
      quickActions: parsed.quickActions || [],
      sql: parsed.sql || undefined,
      sqlType: parsed.sqlType || undefined,
      isSqlMode,
      sessionId: chatSession?.id // Return session ID for client to use in subsequent calls
    });
  } catch (error) {
    console.error('Chat API error:', error);
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Internal server error');
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
