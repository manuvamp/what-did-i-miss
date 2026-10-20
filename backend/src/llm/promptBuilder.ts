import { StructuredContext, formatTime } from './types';

/**
 * Builds the structured prompt from retrieved context.
 * The model never receives a raw transcript — only structured,
 * timestamped, spoiler-filtered information.
 */
export function buildRecapPrompt(context: StructuredContext): string {
  const sections: string[] = [];

  sections.push(`CURRENT PLAYBACK POSITION:\n${formatTime(context.positionMs)}`);

  sections.push(
    `MISSED WINDOW:\n${formatTime(context.missedWindow.startMs)} → ${formatTime(context.missedWindow.endMs)}`
  );

  if (context.currentScene) {
    // Title only: the summary of the scene in progress covers parts the viewer
    // hasn't seen yet. What happened so far comes from the time-gated events.
    sections.push(`CURRENT SCENE:\n${context.currentScene.title}`);
  }

  if (context.events.length > 0) {
    sections.push(
      `IMMEDIATE EVENTS:\n${context.events.map(e => `- ${e.description}`).join('\n')}`
    );
  }

  if (context.subtitles.length > 0) {
    const lines = context.subtitles
      .slice(-12)
      .map(c => `- ${c.speaker ? `${c.speaker}: ` : ''}${c.text}`)
      .join('\n');
    sections.push(`DIALOGUE IN WINDOW:\n${lines}`);
  }

  if (context.priorContext.length > 0) {
    sections.push(
      `RELEVANT PREVIOUS CONTEXT:\n${context.priorContext.map(p => `- ${p}`).join('\n')}`
    );
  }

  if (context.storyState) {
    const s = context.storyState;
    const stateLines: string[] = [];
    if (s.discoveredClues.length > 0) stateLines.push(`- Clues known: ${s.discoveredClues.join(', ')}`);
    if (s.unresolvedQuestions.length > 0) stateLines.push(`- Unresolved questions: ${s.unresolvedQuestions.join('; ')}`);
    if (s.knownFacts.length > 0) stateLines.push(`- Known facts: ${s.knownFacts.join('; ')}`);
    if (s.currentLocation) stateLines.push(`- Location: ${s.currentLocation}`);
    if (stateLines.length > 0) {
      sections.push(`CURRENT STORY STATE:\n${stateLines.join('\n')}`);
    }
  }

  if (context.characters.length > 0) {
    sections.push(`CHARACTERS PRESENT:\n${context.characters.join(', ')}`);
  }

  sections.push(
    `STRICT RULES:
1. Do not mention, infer, or hint at any events after ${formatTime(context.positionMs)}.
2. Only use information provided above. Never invent events, characters, or clues.
3. Keep the summary to 2–4 short sentences — about 10–20 seconds when spoken aloud.
4. Priority: what happened, what matters, why it matters.
5. Return ONLY valid JSON matching the required schema. No markdown, no commentary.

Return JSON with exactly these fields:
{
  "summary": string,
  "importantEvents": string[] (up to 3, in plain language),
  "importantClue": { "text": string, "confidence": number 0..1 } or null,
  "relevantEarlierContext": string[] (earlier facts that make this section make sense)
}`
  );

  return sections.join('\n\n');
}

export function buildQuestionPrompt(question: string, context: StructuredContext): string {
  const sections: string[] = [];

  sections.push(`VIEWER QUESTION:\n${question}`);

  sections.push(`CURRENT PLAYBACK POSITION:\n${formatTime(context.positionMs)}`);

  if (context.currentScene) {
    sections.push(`CURRENT SCENE:\n${context.currentScene.title}`);
  }

  if (context.events.length > 0) {
    sections.push(`RECENT EVENTS:\n${context.events.map(e => `- ${e.description}`).join('\n')}`);
  }

  if (context.clues.length > 0) {
    sections.push(
      `CLUES THE VIEWER KNOWS:\n${context.clues.map(c => `- ${c.title}: ${c.description}`).join('\n')}`
    );
  }

  if (context.priorContext.length > 0) {
    sections.push(`EARLIER STORY CONTEXT:\n${context.priorContext.map(p => `- ${p}`).join('\n')}`);
  }

  if (context.storyState) {
    const s = context.storyState;
    if (s.knownFacts.length > 0) {
      sections.push(`KNOWN FACTS:\n${s.knownFacts.map(f => `- ${f}`).join('\n')}`);
    }
  }

  sections.push(
    `STRICT RULES:
1. Do not mention, infer, or hint at any events after ${formatTime(context.positionMs)}.
2. Only use information provided above. Never invent facts.
3. Answer in 2–4 short sentences, conversational, TV-screen readable.
4. If the answer is not yet knowable at this point in the story, say that honestly.
5. Return ONLY valid JSON: { "answer": string }`
  );

  return sections.join('\n\n');
}
