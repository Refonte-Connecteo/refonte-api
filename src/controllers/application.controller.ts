import type { Request, Response } from 'express';
import * as applicationService from '@/services/application.services';
import { asyncHandler } from '@/lib/async-handler';
import { NotFoundError } from '@/errors/index';

export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const applications = await applicationService.findAll();
  res.json(applications);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const application = await applicationService.findById(id);
  if (!application) throw new NotFoundError('Application not found');
  res.json(application);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const application = await applicationService.create(req.body);
  res.status(201).json(application);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const application = await applicationService.update(id, req.body);
  res.json(application);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await applicationService.remove(id);
  res.status(204).send();
});
