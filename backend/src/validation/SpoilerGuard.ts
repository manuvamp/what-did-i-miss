import fs from 'fs';
import path from 'path';
import { config } from '../config';

interface StoryEvent {
  id: string;
  timestampMs: number;
  description: string;
}

interface ValidationResult {
  ok: boolean;
  violations: string[];
}

/**
 * SpoilerGuard validates generated text to ensure it does not reference
 * events that happen after the viewer's current playback position.
 *
 * Layer 1 (retrieval filtering) prevents future data from reaching the LLM.
 * SpoilerGuard is Layer 2: a final check on the generated output.
 *
 * Matching is distinctive-phrase based: an event "signature" is built from
 * pairs of significant words appearing within a small window. Generic words
 * ("father", "building") alone never count; only the distinctive combination
 * of a future event counts (e.g. "signal active", "knew father").
 */
export class SpoilerGuard {
  private eventsCache = new Map<string, StoryEvent[]>();
  private cluesCache = new Map<string, Array<{ discoveredAtMs: number; description: string }>>();

  private static readonly STOP_WORDS = new Set([
    'that', 'this', 'with', 'from', 'they', 'them', 'their', 'there', 'then',
    'what', 'when', 'where', 'have', 'been', 'were', 'into', 'about', 'after',
    'before', 'would', 'could', 'should', 'sarah', 'michael', 'tells', 'says',
    'goes', 'back', 'here', 'the', 'and', 'her', 'his', 'she', 'him', 'out',
    'down', 'appears', 'points', 'directs', 'realizes', 'decides', 'discovers',
    'recognizes', 'connects', 'challenges', 'claims', 'denies', 'asks', 'wants',
    'urges', 'brings', 'admits', 'reveal', 'reveals', 'finds', 'opens'
  ]);

  private loadEvents(contentId: string): StoryEvent[] {
    if (!this.eventsCache.has(contentId)) {
      const slug = contentId.replace(/_\d+$/, '').replace(/_/g, '-');
      const filePath = path.join(config.contentDir, slug, 'events.json');
      if (fs.existsSync(filePath)) {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.eventsCache.set(contentId, raw as StoryEvent[]);
      } else {
        this.eventsCache.set(contentId, []);
      }
    }
    return this.eventsCache.get(contentId)!;
  }

  private loadClues(contentId: string): Array<{ discoveredAtMs: number; description: string }> {
    if (!this.cluesCache.has(contentId)) {
      const slug = contentId.replace(/_\d+$/, '').replace(/_/g, '-');
      const filePath = path.join(config.contentDir, slug, 'clues.json');
      if (fs.existsSync(filePath)) {
        this.cluesCache.set(contentId, JSON.parse(fs.readFileSync(filePath, 'utf-8')));
      } else {
        this.cluesCache.set(contentId, []);
      }
    }
    return this.cluesCache.get(contentId)!;
  }

  private significantWords(description: string): string[] {
    return description
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !SpoilerGuard.STOP_WORDS.has(w));
  }

  /**
   * Build "signature pairs": consecutive significant words, plus
   * skip-one pairs. An event is referenced when at least one signature
   * pair co-occurs in the candidate text within a small distance.
   */
  private signatures(description: string): string[][] {
    const words = this.significantWords(description);
    const sigs: string[][] = [];
    for (let i = 0; i < words.length; i++) {
      if (i + 1 < words.length) sigs.push([words[i], words[i + 1]]);
      if (i + 2 < words.length) sigs.push([words[i], words[i + 2]]);
    }
    return sigs;
  }

  validateText(contentId: string, text: string, maxTimestampMs: number): ValidationResult {
    const violations: string[] = [];
    const events = this.loadEvents(contentId);
    const futureEvents = events.filter(e => e.timestampMs > maxTimestampMs);
    if (futureEvents.length === 0 || text.trim().length === 0) {
      return { ok: true, violations };
    }

    const textWords = text
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);

    const positions = new Map<string, number[]>();
    textWords.forEach((w, i) => {
      const list = positions.get(w) ?? [];
      list.push(i);
      positions.set(w, list);
    });

    // Pairs already legitimately known through discovered clues are not
    // spoilers on their own — e.g. if a discovered clue already said the
    // building connects to Sarah's father, mentioning "father" is fine.
    // But a pair that only exists in a FUTURE event remains a violation.
    const knownPairs = new Set<string>();
    for (const clue of this.loadClues(contentId)) {
      if (clue.discoveredAtMs <= maxTimestampMs) {
        for (const [a, b] of this.signatures(clue.description)) {
          knownPairs.add(`${a}|${b}`);
        }
      }
    }

    for (const event of futureEvents) {
      const sigs = this.signatures(event.description);
      let matched: string | null = null;

      for (const [a, b] of sigs) {
        if (knownPairs.has(`${a}|${b}`)) continue;
        const posA = positions.get(a);
        const posB = positions.get(b);
        if (!posA || !posB) continue;
        const close = posA.some(pa => posB.some(pb => Math.abs(pa - pb) <= 3));
        if (close) {
          matched = `${a} + ${b}`;
          break;
        }
      }

      if (matched) {
        violations.push(
          `Possible spoiler from event "${event.id}" (t=${event.timestampMs}ms > ${maxTimestampMs}ms): matched pair "${matched}"`
        );
      }
    }

    return { ok: violations.length === 0, violations };
  }

  clearCache(): void {
    this.eventsCache.clear();
    this.cluesCache.clear();
  }
}
