import type { Request, Response } from 'express';
import * as articleService from '@/services/article.services';
import { asyncHandler } from '@/lib/async-handler';
import { NotFoundError } from '@/errors/index';

export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const articles = await articleService.findAll();
  res.json(articles);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const article = await articleService.findById(id);
  if (!article) throw new NotFoundError('Article not found');
  res.json(article);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const article = await articleService.create(req.body);
  res.status(201).json(article);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const article = await articleService.update(id, req.body);
  res.json(article);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await articleService.remove(id);
  res.status(204).send();
});
