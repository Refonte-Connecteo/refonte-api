import type { Request, Response } from 'express';
import * as eventService from '@/services/event.services';
import { asyncHandler } from '@/lib/async-handler';
import { NotFoundError } from '@/errors/index';

export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const events = await eventService.findAll();
  res.json(events);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const event = await eventService.findById(id);
  if (!event) throw new NotFoundError('Event not found');
  res.json(event);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const event = await eventService.create(req.body);
  res.status(201).json(event);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const event = await eventService.update(id, req.body);
  res.json(event);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await eventService.remove(id);
  res.status(204).send();
});
