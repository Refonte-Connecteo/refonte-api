import type { Request, Response, NextFunction } from 'express';
import * as kpiService from '@/services/kpi.services';
import { asyncHandler } from '@/lib/async-handler';
import { NotFoundError } from '@/errors/index';

export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const stats = await kpiService.findAll();
  res.json(stats);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const stat = await kpiService.findById(id);
  if (!stat) throw new NotFoundError('KPI stat not found');
  res.json(stat);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const stat = await kpiService.create(req.body);
  res.status(201).json(stat);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const stat = await kpiService.update(id, req.body);
  if (!stat) throw new NotFoundError('KPI stat not found');
  res.json(stat);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await kpiService.remove(id);
  res.status(204).send();
});
