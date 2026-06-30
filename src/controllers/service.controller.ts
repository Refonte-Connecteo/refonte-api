import type { Request, Response } from 'express';
import * as serviceService from '@/services/service.services';
import * as sectorService from '@/services/sector.services';
import { asyncHandler } from '@/lib/async-handler';
import { NotFoundError } from '@/errors/index';

function parseFormBody<T>(body: T): T {
  const parsed = { ...body } as Record<string, unknown>;
  if (parsed.position !== undefined) parsed.position = Number(parsed.position);
  if (parsed.is_active !== undefined) parsed.is_active = parsed.is_active === 'true' || parsed.is_active === true;
  return parsed as T;
}

export const getAll = asyncHandler(async (_req: Request, res: Response) => {
  const services = await serviceService.findAll();
  res.json(services);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const service = await serviceService.findById(id);
  if (!service) throw new NotFoundError('Service not found');
  res.json(service);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  const service = await serviceService.create(parseFormBody(req.body), file);
  res.status(201).json(service);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const file = req.file;
  const service = await serviceService.update(id, parseFormBody(req.body), file);
  if (!service) throw new NotFoundError('Service not found');
  res.json(service);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const deleted = await serviceService.remove(id);
  if (!deleted) throw new NotFoundError('Service not found');
  res.status(204).send();
});

export const getSectors = asyncHandler(async (req: Request, res: Response) => {
  const serviceId = Number(req.params.id);
  const service = await serviceService.findById(serviceId);
  if (!service) throw new NotFoundError('Service not found');
  const sectors = await sectorService.findAllByService(serviceId);
  res.json(sectors);
});

export const createSector = asyncHandler(async (req: Request, res: Response) => {
  const serviceId = Number(req.params.id);
  const service = await serviceService.findById(serviceId);
  if (!service) throw new NotFoundError('Service not found');
  const sector = await sectorService.create(serviceId, parseFormBody(req.body));
  res.status(201).json(sector);
});

export const updateSector = asyncHandler(async (req: Request, res: Response) => {
  const sectorId = Number(req.params.sectorId);
  const sector = await sectorService.findById(sectorId);
  if (!sector) throw new NotFoundError('Sector not found');
  const updated = await sectorService.update(sectorId, parseFormBody(req.body));
  res.json(updated);
});

export const removeSector = asyncHandler(async (req: Request, res: Response) => {
  const sectorId = Number(req.params.sectorId);
  const sector = await sectorService.findById(sectorId);
  if (!sector) throw new NotFoundError('Sector not found');
  await sectorService.remove(sectorId);
  res.status(204).send();
});
