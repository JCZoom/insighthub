import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const OVERRIDES_FILE = join(DATA_DIR, 'prompt-overrides.json');

export interface PromptOverrides {
  /** Custom instructions appended after the Rules section of the system prompt */
  customInstructions: string;
  /** ISO timestamp of last edit */
  lastModified: string;
  /** Who last edited */
  lastModifiedBy: string;
}

const DEFAULTS: PromptOverrides = {
  customInstructions: '',
  lastModified: '',
  lastModifiedBy: '',
};

/**
 * Read prompt overrides from file. Returns defaults if file doesn't exist.
 */
export async function getPromptOverrides(): Promise<PromptOverrides> {
  try {
    const raw = await readFile(OVERRIDES_FILE, 'utf-8');
    const saved = JSON.parse(raw);
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Save prompt overrides to file.
 */
export async function savePromptOverrides(
  overrides: Partial<PromptOverrides>
): Promise<PromptOverrides> {
  const current = await getPromptOverrides();
  const merged = { ...current, ...overrides };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(OVERRIDES_FILE, JSON.stringify(merged, null, 2), 'utf-8');

  return merged;
}
