import type { Request, Response } from 'express';
import * as ceoMessageService from '@/services/ceo-message.services';
import { asyncHandler } from '@/lib/async-handler';
import { NotFoundError } from '@/errors/index';

export const getAll = asyncHandler(async (_req: Request, res: Response) => {
  const messages = await ceoMessageService.findAll();
  res.json(messages);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const message = await ceoMessageService.findById(id);
  if (!message) throw new NotFoundError('Message CEO non trouvé');
  res.json(message);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const message = await ceoMessageService.create(req.body);
  res.status(201).json(message);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const message = await ceoMessageService.update(id, req.body);
  if (!message) throw new NotFoundError('Message CEO non trouvé');
  res.json(message);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await ceoMessageService.remove(id);
  res.status(204).send();
});
