import type { Request, Response } from 'express';
import * as spontaneousApplicationService from '@/services/spontaneous-application.services';
import { asyncHandler } from '@/lib/async-handler';
import { NotFoundError } from '@/errors/index';

export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const applications = await spontaneousApplicationService.findAll();
  res.json(applications);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const application = await spontaneousApplicationService.findById(id);
  if (!application) throw new NotFoundError('Spontaneous application not found');
  res.json(application);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const application = await spontaneousApplicationService.create(req.body);
  res.status(201).json(application);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const application = await spontaneousApplicationService.update(id, req.body);
  res.json(application);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await spontaneousApplicationService.remove(id);
  res.status(204).send();
});
