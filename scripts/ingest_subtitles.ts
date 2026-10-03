import fs from 'fs';
import path from 'path';

interface SubtitleCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string;
  sceneId?: string;
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const secondsParts = parts[2].split(/[,.]/);
  const seconds = parseInt(secondsParts[0], 10);
  const millis = parseInt(secondsParts[1].padEnd(3, '0').substring(0, 3), 10);
  return hours * 3600000 + minutes * 60000 + seconds * 1000 + millis;
}

function cleanText(text: string): string {
  // Remove HTML-like tags
  let cleaned = text.replace(/<[^>]+>/g, '');
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function parseVtt(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const blocks = content.split(/\n\n+/);
  let cueIndex = 0;

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    // Find timestamp line
    const tsLine = lines.find(l => l.includes('-->'));
    if (!tsLine) continue;

    const [startStr, endStr] = tsLine.split('-->').map(s => s.trim());
    if (!startStr || !endStr) continue;

    // Find text lines (everything after timestamp line)
    const tsIndex = lines.indexOf(tsLine);
    const textLines = lines.slice(tsIndex + 1);
    const text = cleanText(textLines.join(' '));
    if (!text) continue;

    // Extract speaker if present (format: "SPEAKER: text")
    let speaker: string | undefined;
    let cueText = text;
    const speakerMatch = text.match(/^([A-Z][a-zA-Z]+):\s*(.+)$/);
    if (speakerMatch) {
      speaker = speakerMatch[1];
      cueText = speakerMatch[2];
    }

    cues.push({
      id: `cue_${String(cueIndex++).padStart(4, '0')}`,
      startMs: parseTimestamp(startStr),
      endMs: parseTimestamp(endStr),
      text: cueText,
      speaker
    });
  }

  // Merge consecutive tiny cues from same speaker
  const merged: SubtitleCue[] = [];
  for (const cue of cues) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.speaker === cue.speaker &&
      cue.startMs - last.endMs < 500 &&
      last.text.length + cue.text.length < 200
    ) {
      last.endMs = cue.endMs;
      last.text = `${last.text} ${cue.text}`;
    } else {
      merged.push({ ...cue, id: `cue_${String(merged.length).padStart(4, '0')}` });
    }
  }

  return merged;
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath || !outputPath) {
    console.error('Usage: ts-node ingest_subtitles.ts <input.vtt> <output.json>');
    process.exit(1);
  }

  const vttContent = fs.readFileSync(inputPath, 'utf-8');
  const cues = parseVtt(vttContent);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(cues, null, 2));

  console.log(`Parsed ${cues.length} cues from ${inputPath}`);
  console.log(`Written to ${outputPath}`);
}

main();
