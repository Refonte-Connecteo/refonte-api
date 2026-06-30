import type { Request, Response } from 'express';
import * as catalogueService from '@/services/catalogue.services';
import { asyncHandler } from '@/lib/async-handler';
import { NotFoundError } from '@/errors/index';

export const getAll = asyncHandler(async (_req: Request, res: Response) => {
  const catalogues = await catalogueService.findAll();
  res.json(catalogues);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const catalogue = await catalogueService.findById(id);
  if (!catalogue) throw new NotFoundError('Catalogue non trouvé');
  res.json(catalogue);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const catalogue = await catalogueService.create(req.body);
  res.status(201).json(catalogue);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const catalogue = await catalogueService.update(id, req.body);
  if (!catalogue) throw new NotFoundError('Catalogue non trouvé');
  res.json(catalogue);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await catalogueService.remove(id);
  res.status(204).send();
});
