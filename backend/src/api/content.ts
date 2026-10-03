import { Router } from 'express';
import { StoryEngine, contentSlug } from '../story/StoryEngine';
import { config } from '../config';
import path from 'path';
import fs from 'fs';

const router = Router();
const engine = new StoryEngine();

router.get('/', (req, res) => {
  const contentDir = config.contentDir;
  if (!fs.existsSync(contentDir)) return res.json([]);
  const items = fs
    .readdirSync(contentDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const metaPath = path.join(contentDir, d.name, 'metadata.json');
      if (!fs.existsSync(metaPath)) return null;
      try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  res.json(items);
});

router.get('/:id', (req, res) => {
  const meta = engine.getMetadata(req.params.id);
  if (!meta) return res.status(404).json({ error: 'Content not found' });
  res.json(meta);
});

router.get('/:id/scenes', (req, res) => {
  const dir = path.join(config.contentDir, contentSlug(req.params.id));
  const p = path.join(dir, 'scenes.json');
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Scenes not found' });
  const positionMs = req.query.positionMs ? parseInt(String(req.query.positionMs), 10) : null;
  const scenes = JSON.parse(fs.readFileSync(p, 'utf-8'));
  // Spoiler-safe: only reveal scenes that have started before the given position
  if (positionMs !== null && Number.isFinite(positionMs)) {
    return res.json(scenes.filter((s: any) => s.startMs <= positionMs));
  }
  res.json(scenes);
});

router.get('/:id/subtitles', (req, res) => {
  const dir = path.join(config.contentDir, contentSlug(req.params.id));
  const p = path.join(dir, 'subtitles.json');
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Subtitles not found' });
  const startMs = req.query.startMs ? parseInt(String(req.query.startMs), 10) : 0;
  const endMs = req.query.endMs ? parseInt(String(req.query.endMs), 10) : Infinity;
  const cues = JSON.parse(fs.readFileSync(p, 'utf-8'));
  res.json(
    cues.filter(
      (c: any) =>
        c.endMs > startMs && c.startMs < endMs && (endMs === Infinity || c.endMs <= endMs)
    )
  );
});

export const contentRouter = router;
