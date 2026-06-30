import type { Request, Response } from 'express';
import prisma from '@/lib/prisma';
import { contactSchema } from '@/schemas/contact.schema';
import { sendContactEmail } from '@/services/email.service';
import { ValidationError } from '@/errors/index';
import { asyncHandler } from '@/lib/async-handler';

export const submit = asyncHandler(async (req: Request, res: Response) => {
  const parsed = contactSchema.safeParse(req.body);

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.');
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    }
    throw new ValidationError('Données de contact invalides', errors);
  }

  const data = parsed.data;

  const message = await prisma.contact_message.create({
    data: {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone ?? null,
      company: data.company ?? null,
      country: data.country ?? null,
      message: data.message,
    },
  });

  try {
    await sendContactEmail(data);
  } catch (error) {
    console.error("Échec de l'envoi de l'email de notification :", error);
  }

  res.status(201).json({
    message: 'Votre message a bien été envoyé. Nous vous répondrons dans les plus brefs délais.',
  });
});
