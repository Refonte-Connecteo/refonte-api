import type { Request, Response, NextFunction } from 'express';
import * as heroService from '@/services/hero.services';
import { asyncHandler } from '@/lib/async-handler';
import { NotFoundError } from '@/errors/index';

export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const slides = await heroService.findAll();
  res.json(slides);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const slide = await heroService.findById(id);
  if (!slide) throw new NotFoundError('Hero slide not found');
  res.json(slide);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const slide = await heroService.create(req.body);
  res.status(201).json(slide);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const slide = await heroService.update(id, req.body);
  if (!slide) throw new NotFoundError('Hero slide not found');
  res.json(slide);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await heroService.remove(id);
  res.status(204).send();
});
