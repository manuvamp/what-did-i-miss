import fs from 'fs';
import path from 'path';

interface ValidationError {
  file: string;
  error: string;
  severity: 'error' | 'warning';
}

function validateJsonFile(filePath: string, requiredFields: string[]): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!fs.existsSync(filePath)) {
    errors.push({ file: filePath, error: 'File not found', severity: 'error' });
    return errors;
  }

  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (!Array.isArray(content)) {
      // Single object
      for (const field of requiredFields) {
        if (!(field in content)) {
          errors.push({ file: filePath, error: `Missing required field: ${field}`, severity: 'error' });
        }
      }
    } else {
      // Array of objects
      for (let i = 0; i < content.length; i++) {
        for (const field of requiredFields) {
          if (!(field in content[i])) {
            errors.push({ file: filePath, error: `[${i}] Missing required field: ${field}`, severity: 'error' });
          }
        }
      }
    }
  } catch (e) {
    errors.push({ file: filePath, error: `Invalid JSON: ${e}`, severity: 'error' });
  }

  return errors;
}

function validateTimestamps(items: Array<{ startMs?: number; endMs?: number; timestampMs?: number }>, filePath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.startMs !== undefined && item.endMs !== undefined) {
      if (item.startMs >= item.endMs) {
        errors.push({ file: filePath, error: `[${i}] startMs >= endMs`, severity: 'error' });
      }
    }
    if (item.startMs !== undefined && item.startMs < 0) {
      errors.push({ file: filePath, error: `[${i}] Negative startMs`, severity: 'error' });
    }
    if (item.timestampMs !== undefined && item.timestampMs < 0) {
      errors.push({ file: filePath, error: `[${i}] Negative timestampMs`, severity: 'error' });
    }
  }

  return errors;
}

function validateContent(contentDir: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required files
  const requiredFiles = [
    { name: 'metadata.json', fields: ['contentId', 'title', 'type', 'durationMs'] },
    { name: 'subtitles.json', fields: ['id', 'startMs', 'endMs', 'text'] },
    { name: 'scenes.json', fields: ['id', 'startMs', 'endMs', 'title', 'summary'] },
    { name: 'events.json', fields: ['id', 'timestampMs', 'type', 'description', 'importance', 'spoilerBoundaryMs'] },
    { name: 'clues.json', fields: ['id', 'title', 'description', 'discoveredAtMs', 'status'] },
    { name: 'frames.json', fields: ['id', 'timestampMs', 'sceneId', 'path'] }
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(contentDir, file.name);
    errors.push(...validateJsonFile(filePath, file.fields));
  }

  // Validate timestamps
  const subtitlePath = path.join(contentDir, 'subtitles.json');
  if (fs.existsSync(subtitlePath)) {
    const subtitles = JSON.parse(fs.readFileSync(subtitlePath, 'utf-8'));
    errors.push(...validateTimestamps(subtitles, subtitlePath));
  }

  const scenePath = path.join(contentDir, 'scenes.json');
  if (fs.existsSync(scenePath)) {
    const scenes = JSON.parse(fs.readFileSync(scenePath, 'utf-8'));
    errors.push(...validateTimestamps(scenes, scenePath));
  }

  const eventPath = path.join(contentDir, 'events.json');
  if (fs.existsSync(eventPath)) {
    const events = JSON.parse(fs.readFileSync(eventPath, 'utf-8'));
    errors.push(...validateTimestamps(events, eventPath));
  }

  // Cross-reference validation
  if (fs.existsSync(scenePath) && fs.existsSync(eventPath)) {
    const scenes = JSON.parse(fs.readFileSync(scenePath, 'utf-8'));
    const events = JSON.parse(fs.readFileSync(eventPath, 'utf-8'));

    const sceneIds = new Set(scenes.map((s: any) => s.id));
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.sceneId && !sceneIds.has(event.sceneId)) {
        errors.push({
          file: eventPath,
          error: `[${i}] Event references non-existent scene: ${event.sceneId}`,
          severity: 'error'
        });
      }
    }
  }

  return errors;
}

function main() {
  const contentDir = process.argv[2] || path.join(process.cwd(), 'content', 'last-signal');

  console.log(`Validating content in: ${contentDir}\n`);

  const errors = validateContent(contentDir);

  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  for (const error of errors) {
    const icon = error.severity === 'error' ? '✗' : '⚠';
    console.log(`${icon} ${error.file}: ${error.error}`);
  }

  console.log(`\n${errorCount} errors, ${warningCount} warnings`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

main();
