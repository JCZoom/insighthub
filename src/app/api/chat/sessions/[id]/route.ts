import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await params;

    // Get session with messages, ensuring user owns the session
    const session = await prisma.chatSession.findUnique({
      where: {
        id: sessionId,
        userId: user.id, // Ensure user can only access their own sessions
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      );
    }

    // Transform messages to match ChatMessageUI format
    const messages = session.messages.map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
      schemaChange: msg.schemaChange || undefined,
      createdAt: msg.createdAt,
    }));

    return NextResponse.json({
      session: {
        id: session.id,
        userId: session.userId,
        dashboardId: session.dashboardId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      messages
    });
  } catch (error) {
    console.error('Error fetching chat session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat session' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}