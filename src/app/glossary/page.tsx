import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { Navbar } from '@/components/layout/Navbar';
import { GlossaryClient, type GlossaryEntry } from './glossary-client';

function loadGlossary(): GlossaryEntry[] {
  try {
    const filePath = path.join(process.cwd(), 'glossary', 'terms.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    const entries = YAML.parse(content);
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

export default function GlossaryPage() {
  const terms = loadGlossary();
  return (
    <>
      <Navbar />
      <GlossaryClient initialTerms={terms} />
    </>
  );
}
