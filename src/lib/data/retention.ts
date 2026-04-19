import prisma from '@/lib/db/prisma';

/** Default retention period in days for chat messages */
const CHAT_RETENTION_DAYS = 90;

/**
 * Purge chat messages and empty sessions older than the retention period.
 *
 * 1. Deletes ChatMessage rows whose createdAt < cutoff.
 * 2. Deletes ChatSession rows that have zero remaining messages
 *    (cascade from step 1 may orphan sessions).
 *
 * Returns counts of deleted messages and sessions.
 */
export async function purgeChatMessages(
  retentionDays: number = CHAT_RETENTION_DAYS
): Promise<{ deletedMessages: number; deletedSessions: number }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  // Step 1: Delete old messages
  const { count: deletedMessages } = await prisma.chatMessage.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  // Step 2: Clean up orphaned sessions (no messages left)
  const { count: deletedSessions } = await prisma.chatSession.deleteMany({
    where: {
      messages: { none: {} },
      createdAt: { lt: cutoff },
    },
  });

  return { deletedMessages, deletedSessions };
}
