import { Router } from 'express';
import { z } from 'zod';
import { QuestionService } from '../story/QuestionService';

const router = Router();

const QuestionRequestSchema = z.object({
  contentId: z.string(),
  question: z.string().min(1).max(500),
  currentPositionMs: z.number().int().min(0)
});

const QuestionResponseSchema = z.object({
  answer: z.string(),
  spoilerChecked: z.boolean()
});

export type QuestionRequest = z.infer<typeof QuestionRequestSchema>;
export type QuestionResponse = z.infer<typeof QuestionResponseSchema>;

router.post('/', async (req, res) => {
  try {
    const parsed = QuestionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    const service = new QuestionService();
    const result = await service.answer(parsed.data);
    res.json(result);
  } catch (error) {
    console.error('Question error:', error);
    res.status(500).json({
      answer: "I can't answer that right now. Try continuing to watch.",
      spoilerChecked: false
    });
  }
});

export const questionRouter = router;
