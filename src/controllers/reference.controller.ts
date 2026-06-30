import type { Request, Response } from 'express';
import * as referenceService from '@/services/reference.services';
import { asyncHandler } from '@/lib/async-handler';
import { NotFoundError } from '@/errors/index';

export const getAll = asyncHandler(async (_req: Request, res: Response) => {
  const references = await referenceService.findAll();
  res.json(references);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const reference = await referenceService.findById(id);
  if (!reference) throw new NotFoundError('Référence non trouvée');
  res.json(reference);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const reference = await referenceService.create(req.body);
  res.status(201).json(reference);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const reference = await referenceService.update(id, req.body);
  if (!reference) throw new NotFoundError('Référence non trouvée');
  res.json(reference);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await referenceService.remove(id);
  res.status(204).send();
});
