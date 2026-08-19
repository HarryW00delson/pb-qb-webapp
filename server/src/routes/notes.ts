import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../db/client.js';

const createNoteSchema = z.object({
  content: z.string().trim().min(1).max(1000),
});

/**
 * Sample CRUD routes demonstrating the optional database wiring.
 * Only mounted when DATABASE_ENABLED=true (see app.ts). Replace with
 * your own domain routes/models.
 */
export function createNotesRouter(prisma: PrismaClient) {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    const notes = await prisma.note.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(notes);
  });

  router.post('/', async (req: Request, res: Response) => {
    const parsed = createNoteSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: z.prettifyError(parsed.error) });
      return;
    }

    const note = await prisma.note.create({
      data: { content: parsed.data.content },
    });
    res.status(201).json(note);
  });

  return router;
}
