import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import type { DashboardSchema } from '@/types';
import { withRateLimit, chatRateLimiter } from '@/lib/rate-limiter';
import { getCurrentUser } from '@/lib/auth/session';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface YamlGlossaryEntry {
  term: string;
  category: string;
  definition: string;
  formula?: string;
}

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

// Simulate streaming by breaking response processing into chunks
async function* processResponseStream(
  rawText: string,
  message: string,
  isSqlMode: boolean
): AsyncGenerator<{ event: string; data: any }> {
  // Simulate processing delay and send progress updates
  yield { event: 'progress', data: { message: 'Processing your request...', progress: 10 } };
  await new Promise(resolve => setTimeout(resolve, 100));

  yield { event: 'progress', data: { message: 'Analyzing requirements...', progress: 30 } };
  await new Promise(resolve => setTimeout(resolve, 150));

  // Parse the response
  let parsed: { explanation: string; patches?: unknown[]; quickActions?: unknown[]; sql?: string; sqlType?: string };

  if (isSqlMode) {
    yield { event: 'progress', data: { message: 'Generating SQL query...', progress: 60 } };
    await new Promise(resolve => setTimeout(resolve, 100));

    // For SQL mode, handle different response formats
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
      const jsonStr = jsonMatch[1]?.trim();

      if (jsonStr) {
        parsed = JSON.parse(jsonStr);
      } else {
        // Extract SQL from code blocks if present
        const sqlMatch = rawText.match(/```sql\s*([\s\S]*?)```/);
        const sql = sqlMatch ? sqlMatch[1].trim() : null;

        parsed = {
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

      parsed = {
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
    yield { event: 'progress', data: { message: 'Generating dashboard schema...', progress: 60 } };
    await new Promise(resolve => setTimeout(resolve, 100));

    // Regular dashboard mode
    try {
      // Try to extract JSON from the response (Claude sometimes wraps in markdown code blocks)
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
      const jsonStr = jsonMatch[1]?.trim() || rawText.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, treat the whole response as an explanation with no patches
      parsed = {
        explanation: rawText || 'I understood your request but had trouble generating the schema. Could you try rephrasing?',
        patches: [],
        quickActions: [],
      };
    }
  }

  yield { event: 'progress', data: { message: 'Finalizing response...', progress: 90 } };
  await new Promise(resolve => setTimeout(resolve, 50));

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
          progress: 95 + (i / parsed.patches.length) * 5
        }
      };
      // Small delay between patches to show progressive updates
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // Send explanation and completion
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

  yield { event: 'complete', data: { sessionId: null } }; // Will be updated with actual sessionId
}

// Handle GET requests for EventSource streaming
export async function GET(request: NextRequest) {
  return withRateLimit(request, chatRateLimiter, 'chat', async () => {
    const { searchParams } = new URL(request.url);
    const message = searchParams.get('message');
    const currentSchemaStr = searchParams.get('currentSchema');
    const conversationHistoryStr = searchParams.get('conversationHistory');
    const sessionId = searchParams.get('sessionId') || undefined;
    const dashboardId = searchParams.get('dashboardId') || undefined;
    const stream = searchParams.get('stream') === 'true';

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Parse JSON parameters
    let currentSchema = null;
    let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];

    try {
      if (currentSchemaStr) currentSchema = JSON.parse(currentSchemaStr);
      if (conversationHistoryStr) conversationHistory = JSON.parse(conversationHistoryStr);
    } catch (error) {
      console.error('Failed to parse GET parameters:', error);
    }

    return handleChatRequest({
      message,
      currentSchema,
      conversationHistory,
      sessionId,
      dashboardId,
      stream
    });
  });
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, chatRateLimiter, 'chat', async () => {
    const body = await request.json();
    const { message, currentSchema, conversationHistory, sessionId, dashboardId, stream = false } = body as {
      message: string;
      currentSchema: DashboardSchema | null;
      conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
      sessionId?: string;
      dashboardId?: string;
      stream?: boolean;
    };

    return handleChatRequest({
      message,
      currentSchema,
      conversationHistory,
      sessionId,
      dashboardId,
      stream
    });
  });
}

// Shared chat request handler
async function handleChatRequest({
  message,
  currentSchema,
  conversationHistory,
  sessionId,
  dashboardId,
  stream
}: {
  message: string;
  currentSchema: DashboardSchema | null;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
  sessionId?: string;
  dashboardId?: string;
  stream: boolean;
}) {
  try {
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'ANTHROPIC_API_KEY not configured. Add it to .env.local' },
          { status: 500 },
        );
      }

      const anthropic = new Anthropic({ apiKey });
      const glossaryTerms = loadGlossaryForPrompt();

      // Get current user for permission-based data source filtering
      let currentUser;
      try {
        currentUser = await getCurrentUser();
      } catch (error) {
        // If user session retrieval fails, continue without user context (more restrictive permissions)
        console.warn('Failed to retrieve user session for chat API:', error);
        currentUser = undefined;
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

      const systemPrompt = buildSystemPrompt(glossaryTerms, currentSchema, undefined, currentUser);

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
        conversationHistory && conversationHistory.length > 0
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
              // Call Anthropic API
              const response = await anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                system: systemPrompt,
                messages,
              });

              const textBlock = response.content.find(b => b.type === 'text');
              const rawText = textBlock?.type === 'text' ? textBlock.text : '';

              // Process response and stream updates
              let finalParsedData: any = null;
              for await (const chunk of processResponseStream(rawText, message, isSqlMode)) {
                if (chunk.event === 'explanation') {
                  finalParsedData = chunk.data;
                  // Update sessionId in the completion data
                  finalParsedData.sessionId = chatSession?.id;
                }
                controller.enqueue(new TextEncoder().encode(formatSSE(chunk.event, chunk.data)));
              }

              // Save assistant message to database
              if (chatSession && finalParsedData) {
                try {
                  // We need to collect all patches from the stream to save
                  const explanation = finalParsedData.explanation || '';

                  await prisma.chatMessage.create({
                    data: {
                      sessionId: chatSession.id,
                      role: 'assistant',
                      content: explanation,
                      schemaChange: null, // Will be updated if patches were streamed
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
              const errorMessage = error instanceof Error ? error.message : 'Internal server error';
              controller.enqueue(new TextEncoder().encode(formatSSE('error', { error: errorMessage })));
              controller.close();
            } finally {
              await prisma.$disconnect();
            }
          }
        });

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
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

      // Parse the response - try JSON first, then handle SQL mode responses
      let parsed: { explanation: string; patches?: unknown[]; quickActions?: unknown[]; sql?: string; sqlType?: string };

      if (isSqlMode) {
        // For SQL mode, handle different response formats
        try {
          const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
          const jsonStr = jsonMatch[1]?.trim();

          if (jsonStr) {
            parsed = JSON.parse(jsonStr);
          } else {
            // Extract SQL from code blocks if present
            const sqlMatch = rawText.match(/```sql\s*([\s\S]*?)```/);
            const sql = sqlMatch ? sqlMatch[1].trim() : null;

            parsed = {
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

          parsed = {
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
          parsed = JSON.parse(jsonStr);
        } catch {
          // If JSON parsing fails, treat the whole response as an explanation with no patches
          parsed = {
            explanation: rawText || 'I understood your request but had trouble generating the schema. Could you try rephrasing?',
            patches: [],
            quickActions: [],
          };
        }
      }

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
