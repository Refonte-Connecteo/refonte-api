import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/auth.middleware.js";
import { BadRequestError } from "../errors/index.js";
import {
  getAllApplications,
  getApplicationById,
  getApplicationsByJobId,
  createApplication,
  updateApplication,
  deleteApplication,
} from "../services/Application.services.js";

function parseId(rawId: string): number {
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
        throw new BadRequestError("Invalid ID format");
    }   
    return id;
}

export const handleGetAllApplications = asyncHandler(async (req: Request, res: Response) => {
    const applications = await getAllApplications();
    res.json({ applications });
});

export const handleGetApplication = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id as string);
    const application = await getApplicationById(id);
    res.json({ application });
});

export const handleGetApplicationsByJobId = asyncHandler(async (req: Request, res: Response) => {
    const jobId = parseId(req.params.jobId as string);
    const applications = await getApplicationsByJobId(jobId);
    res.json({ applications });
});

export const handleCreateApplication = asyncHandler(async (req: Request, res: Response) => {
  const { job_id, first_name, last_name, email, phone, cv_url, cover_letter } = req.body;
 
  const application = await createApplication({
    job_posting: { connect: { id: job_id } },
    first_name,
    last_name,
    email,
    phone,
    cv_url,
    cover_letter,
  });
 
  res.status(201).json({ message: "Candidature créée avec succès", application });
});
 
export const handleUpdateApplication = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  const { first_name, last_name, email, phone, cv_url, cover_letter } = req.body;
  const application = await updateApplication(id, { first_name, last_name, email, phone, cv_url, cover_letter });
  res.json({ message: "Candidature mise à jour avec succès", application });
});
 
export const handleDeleteApplication = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id as string);
  await deleteApplication(id);
  res.json({ message: "Candidature supprimée avec succès" });
});
