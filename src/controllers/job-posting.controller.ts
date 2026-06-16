import type { Request, Response } from 'express';
import * as jobPostingService from '@/services/job-posting.services';
import { asyncHandler } from '@/lib/async-handler';
import { NotFoundError } from '@/errors/index';

export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const postings = await jobPostingService.findAll();
  res.json(postings);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const posting = await jobPostingService.findById(id);
  if (!posting) throw new NotFoundError('Job posting not found');
  res.json(posting);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const posting = await jobPostingService.create(req.body);
  res.status(201).json(posting);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const posting = await jobPostingService.update(id, req.body);
  res.json(posting);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await jobPostingService.remove(id);
  res.status(204).send();
});
