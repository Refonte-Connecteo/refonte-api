import type { Request, Response, NextFunction } from "express";
import { type ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      res.status(400).json({ error: "Données invalides", details: messages });
      return;
    }
    req.body = result.data;
    next();
  };
}
