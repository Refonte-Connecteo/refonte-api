import type { Request, Response } from 'express';
import { chatSchema } from '@/schemas/chat.schema';
import { getChatResponse } from '@/services/chat.service';
import { ValidationError } from '@/errors/index';
import { asyncHandler } from '@/lib/async-handler';

export const handleChat = asyncHandler(async (req: Request, res: Response) => {
  const parsed = chatSchema.safeParse(req.body);

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.');
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    }
    throw new ValidationError('Données de chat invalides', errors);
  }

  const { message } = parsed.data;
  const reply = await getChatResponse(message);

  res.json({ reply });
});
