import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/auth.middleware.js";
import { parseId } from "../utils/parseId.js";
import { NotFoundError } from "../errors/index.js";
import {
  getAllJobPostings,
  getJobPostingById,
  createJobPosting,
  updateJobPosting,
  deleteJobPosting,
} from "../services/JobPosting.services.js";


export const handleGetAllJobPostings = asyncHandler(async (req: Request, res: Response) => {
    const onlyActive = !req.user || req.query.onlyActive === "true";
    const jobPostings = await getAllJobPostings(onlyActive);
    res.json({ jobPostings });
});

export const handleGetJobPosting = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id as string);
    const jobPosting = await getJobPostingById(id);
    if (!req.user && !jobPosting.is_active) throw new NotFoundError(`Job posting with id ${id} not found`);
    res.json({ jobPosting });
});

export const handleCreateJobPosting = asyncHandler(async (req: Request, res: Response) => {
  const { title, contract_type, description, external_url, fiche_url, is_active } = req.body;
 
  const jobPosting = await createJobPosting({
    title,
    contract_type,
    description,
    external_url,
    fiche_url,
    is_active,
  });
 
  res.status(201).json({ message: "Offre d'emploi créée avec succès", jobPosting });
});
 
export const handleUpdateJobPosting = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  const { title, contract_type, description, external_url, fiche_url, is_active } = req.body;
  const jobPosting = await updateJobPosting(id, { title, contract_type, description, external_url, fiche_url, is_active });
  res.json({ message: "Offre d'emploi mise à jour avec succès", jobPosting });
});
 
export const handleDeleteJobPosting = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  await deleteJobPosting(id);
  res.json({ message: "Offre d'emploi supprimée avec succès" });
});
