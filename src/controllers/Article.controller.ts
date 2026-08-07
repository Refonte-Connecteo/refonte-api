import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/auth.middleware.js";
import { BadRequestError } from "../errors/index.js";
import {
  getAllArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
} from "../services/Article.services.js";

function parseId(rawId: string): number {
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
        throw new BadRequestError("Invalid ID format");
    }   
    return id;
}

export const handleGetAllArticles = asyncHandler(async (req: Request, res: Response) => {
    const onlyPublished = req.query.onlyPublished === "true";
    const articles = await getAllArticles(onlyPublished);
    res.json({ articles });
});

export const handleGetArticle = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id as string);
    const article = await getArticleById(id);
    res.json({ article });
});

export const handleCreateArticle = asyncHandler(async (req: Request, res: Response) => {
  const { title, description, type, cover_url, file_url, is_lead_magnet, is_published, published_at } = req.body;
 
  const article = await createArticle({
    title,
    description,
    type,
    cover_url,
    file_url,
    is_lead_magnet,
    is_published,
    published_at,
  });
 
  res.status(201).json({ message: "Article créé avec succès", article });
});
 
export const handleUpdateArticle = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  const { title, description, type, cover_url, file_url, is_lead_magnet, is_published, published_at } = req.body;
  const article = await updateArticle(id, { title, description, type, cover_url, file_url, is_lead_magnet, is_published, published_at });
  res.json({ message: "Article mis à jour avec succès", article });
});
 
export const handleDeleteArticle = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  await deleteArticle(id);
  res.json({ message: "Article supprimé avec succès" });
});
