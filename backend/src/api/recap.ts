import { Router } from 'express';
import { z } from 'zod';
import { RecapService } from '../story/RecapService';

const router = Router();

const RecapRequestSchema = z.object({
  contentId: z.string(),
  currentPositionMs: z.number().int().positive(),
  windowStartMs: z.number().int().min(0),
  windowEndMs: z.number().int().positive()
});

const RecapResponseSchema = z.object({
  window: z.object({
    startMs: z.number(),
    endMs: z.number()
  }),
  summary: z.string(),
  importantEvents: z.array(z.string()),
  importantClue: z.object({
    text: z.string(),
    confidence: z.number().min(0).max(1)
  }).nullable(),
  relevantEarlierContext: z.array(z.string()),
  characters: z.array(z.string()),
  spoilerChecked: z.boolean()
});

export type RecapRequest = z.infer<typeof RecapRequestSchema>;
export type RecapResponse = z.infer<typeof RecapResponseSchema>;

router.post('/', async (req, res) => {
  try {
    const parsed = RecapRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error });
    }

    const request = parsed.data;

    // Validate window
    if (request.windowStartMs >= request.windowEndMs) {
      return res.status(400).json({ error: 'windowStartMs must be less than windowEndMs' });
    }

    if (request.currentPositionMs < request.windowEndMs) {
      return res.status(400).json({ error: 'currentPositionMs must be >= windowEndMs' });
    }

    const recapService = new RecapService();
    const result = await recapService.generateRecap(request);

    res.json(result);
  } catch (error) {
    console.error('Recap error:', error);
    res.status(500).json({ error: 'Failed to generate recap' });
  }
});

export const recapRouter = router;
