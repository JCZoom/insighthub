import type { SchemaPatch } from '@/types';

/**
 * Generates a concise, human-readable summary of schema changes from patches.
 * This is used for version history to help users understand what changed.
 */
export function generateChangeSummary(
  patches: SchemaPatch[],
  aiExplanation?: string
): string {
  if (!patches || patches.length === 0) {
    return aiExplanation || 'No changes detected';
  }

  // If there's only one patch, create a focused summary
  if (patches.length === 1) {
    return summarizeSinglePatch(patches[0]);
  }

  // For multiple patches, categorize and summarize
  const changes = categorizePatches(patches);
  const summaryParts: string[] = [];

  if (changes.added.length > 0) {
    summaryParts.push(
      `Added ${changes.added.length} widget${changes.added.length === 1 ? '' : 's'}`
    );
  }

  if (changes.updated.length > 0) {
    summaryParts.push(
      `Updated ${changes.updated.length} widget${changes.updated.length === 1 ? '' : 's'}`
    );
  }

  if (changes.removed.length > 0) {
    summaryParts.push(
      `Removed ${changes.removed.length} widget${changes.removed.length === 1 ? '' : 's'}`
    );
  }

  if (changes.layoutUpdated) {
    summaryParts.push('Updated layout');
  }

  if (changes.filtersUpdated) {
    summaryParts.push('Updated filters');
  }

  if (changes.replacedAll) {
    return 'Rebuilt entire dashboard';
  }

  // Join the parts with commas and return
  const summary = summaryParts.join(', ');
  return summary || 'Applied dashboard changes';
}

/**
 * Creates a summary for a single patch
 */
function summarizeSinglePatch(patch: SchemaPatch): string {
  switch (patch.type) {
    case 'add_widget':
      if (patch.widget) {
        return `Added ${patch.widget.title || patch.widget.type} widget`;
      }
      return 'Added new widget';

    case 'remove_widget':
      return 'Removed widget';

    case 'update_widget':
      if (patch.changes?.title) {
        return `Updated widget: ${patch.changes.title}`;
      }
      return 'Updated widget configuration';

    case 'update_layout':
      return 'Updated dashboard layout';

    case 'update_filters':
      return 'Updated dashboard filters';

    case 'replace_all':
      return 'Rebuilt entire dashboard';

    case 'use_widget':
      return 'Added widget from library';

    default:
      return 'Applied dashboard change';
  }
}

/**
 * Categorizes patches by type for better summarization
 */
function categorizePatches(patches: SchemaPatch[]) {
  return patches.reduce(
    (acc, patch) => {
      switch (patch.type) {
        case 'add_widget':
        case 'use_widget':
          acc.added.push(patch);
          break;
        case 'update_widget':
          acc.updated.push(patch);
          break;
        case 'remove_widget':
          acc.removed.push(patch);
          break;
        case 'update_layout':
          acc.layoutUpdated = true;
          break;
        case 'update_filters':
          acc.filtersUpdated = true;
          break;
        case 'replace_all':
          acc.replacedAll = true;
          break;
      }
      return acc;
    },
    {
      added: [] as SchemaPatch[],
      updated: [] as SchemaPatch[],
      removed: [] as SchemaPatch[],
      layoutUpdated: false,
      filtersUpdated: false,
      replacedAll: false,
    }
  );
}

/**
 * Enhances a change summary by incorporating AI explanation context
 */
export function enhanceChangeSummary(
  basicSummary: string,
  aiExplanation?: string
): string {
  if (!aiExplanation) {
    return basicSummary;
  }

  // Extract key action words from AI explanation
  const explanation = aiExplanation.toLowerCase();

  if (explanation.includes('created') || explanation.includes('built')) {
    return `Created: ${basicSummary.toLowerCase()}`;
  }

  if (explanation.includes('modified') || explanation.includes('updated') || explanation.includes('changed')) {
    return `Modified: ${basicSummary.toLowerCase()}`;
  }

  if (explanation.includes('added') || explanation.includes('included')) {
    return `Added: ${basicSummary.toLowerCase()}`;
  }

  if (explanation.includes('removed') || explanation.includes('deleted')) {
    return `Removed: ${basicSummary.toLowerCase()}`;
  }

  if (explanation.includes('reorganized') || explanation.includes('rearranged')) {
    return `Reorganized: ${basicSummary.toLowerCase()}`;
  }

  // If no clear action detected, return the basic summary
  return basicSummary;
}

interface HistoryEntry {
  note: string;
  timestamp: Date;
}

/**
 * Generates a change summary from dashboard history entries since the last save.
 * This looks at recent history entries and creates a concise summary for version history.
 */
export function generateChangeSummaryFromHistory(
  history: HistoryEntry[],
  currentIndex: number,
  sinceTimestamp?: Date
): string {
  if (!history || history.length === 0) {
    return 'Manual save';
  }

  // Get recent changes since the last save or since a specific timestamp
  let relevantEntries: HistoryEntry[];

  if (sinceTimestamp) {
    relevantEntries = history.filter(entry => entry.timestamp > sinceTimestamp);
  } else {
    // Look for recent changes - take last few entries before current
    // This assumes we want to summarize changes since some reasonable cutoff
    relevantEntries = history.slice(Math.max(0, currentIndex - 5), currentIndex + 1);
  }

  if (relevantEntries.length === 0) {
    return 'Manual save';
  }

  // Filter out generic entries like "Loaded" or "Initial state"
  const changeEntries = relevantEntries.filter(entry =>
    !entry.note.toLowerCase().includes('loaded') &&
    !entry.note.toLowerCase().includes('initial') &&
    entry.note !== 'Manual save'
  );

  if (changeEntries.length === 0) {
    return 'Manual save';
  }

  // If there's only one meaningful change, use it directly
  if (changeEntries.length === 1) {
    return changeEntries[0].note;
  }

  // Analyze multiple changes
  const actions = analyzeHistoryEntries(changeEntries);

  if (actions.aiUpdates.length > 0) {
    // If there were AI updates, prioritize the most recent AI explanation
    return actions.aiUpdates[actions.aiUpdates.length - 1];
  }

  // Otherwise, summarize manual actions
  const summaryParts: string[] = [];

  if (actions.added > 0) {
    summaryParts.push(`added ${actions.added} widget${actions.added === 1 ? '' : 's'}`);
  }

  if (actions.updated > 0) {
    summaryParts.push(`updated ${actions.updated} widget${actions.updated === 1 ? '' : 's'}`);
  }

  if (actions.removed > 0) {
    summaryParts.push(`removed ${actions.removed} widget${actions.removed === 1 ? '' : 's'}`);
  }

  if (summaryParts.length > 0) {
    return `Manual changes: ${summaryParts.join(', ')}`;
  }

  return 'Manual save';
}

/**
 * Analyzes history entries to categorize the types of changes
 */
function analyzeHistoryEntries(entries: HistoryEntry[]) {
  return entries.reduce(
    (acc, entry) => {
      const note = entry.note.toLowerCase();

      // Check if this is an AI-generated explanation (usually longer and more descriptive)
      if (note.length > 20 && !note.startsWith('added') && !note.startsWith('removed') && !note.startsWith('updated')) {
        acc.aiUpdates.push(entry.note);
      } else if (note.includes('added')) {
        acc.added++;
      } else if (note.includes('removed')) {
        acc.removed++;
      } else if (note.includes('updated')) {
        acc.updated++;
      }

      return acc;
    },
    {
      added: 0,
      updated: 0,
      removed: 0,
      aiUpdates: [] as string[],
    }
  );
}