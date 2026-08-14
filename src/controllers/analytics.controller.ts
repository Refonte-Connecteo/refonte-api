import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/auth.middleware.js";
import {
  recordPageView,
  getDashboardSummary,
} from "../services/analytics.service.js";

export const handleRecordPageView = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as {
      path?: unknown;
      visitorId?: unknown;
      referrer?: unknown;
    };

    await recordPageView({
      path: typeof body.path === "string" ? body.path : "",
      visitorId: typeof body.visitorId === "string" ? body.visitorId : "",
      referrer: typeof body.referrer === "string" ? body.referrer : null,
      userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
    });

    res.status(204).end();
  },
);

export const handleGetDashboardSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const raw = req.query.range;
    const rangeDays =
      typeof raw === "string" && /^\d{1,3}$/.test(raw)
        ? parseInt(raw, 10)
        : 30;

    const summary = await getDashboardSummary(rangeDays);
    res.json({ summary });
  },
);
