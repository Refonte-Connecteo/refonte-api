import prisma from "../lib/prisma.js";
import { BadRequestError } from "../errors/index.js";

export type DeviceKind = "desktop" | "mobile" | "tablet";

export interface RecordPageViewInput {
  path: string;
  visitorId: string;
  referrer?: string | null;
  userAgent?: string | null;
}

export interface DailyPoint {
  date: string;
  views: number;
  visitors: number;
}

export interface DashboardSummary {
  rangeDays: number;
  totalViews: number;
  uniqueVisitors: number;
  viewsPerDay: number;
  dailySeries: DailyPoint[];
  topPages: { path: string; views: number; visitors: number }[];
  topReferrers: { referrer: string; views: number }[];
  deviceBreakdown: { device: string; views: number }[];
  counts: {
    applications: number;
    spontaneousApplications: number;
    contactMessages: number;
    unreadContactMessages: number;
  };
}

/** Déduit le type d'appareil depuis le user-agent (approximation, aucun cookie). */
export function inferDevice(userAgent?: string | null): DeviceKind {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)/.test(ua)) return "tablet";
  if (/(android)/.test(ua) && !/(mobile)/.test(ua)) return "tablet";
  if (/(mobi|iphone|ipod|android|blackberry|opera mini)/.test(ua)) return "mobile";
  return "desktop";
}

/** Extrait le hostname d'un referrer (ne stocke jamais l'URL complète). */
export function hostFromReferrer(referrer?: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname;
  } catch {
    return null;
  }
}

export async function recordPageView(input: RecordPageViewInput): Promise<void> {
  const path = input.path?.trim() ?? "";
  const visitorId = input.visitorId?.trim() ?? "";

  if (!path.startsWith("/") || path.length > 500) {
    throw new BadRequestError("path invalide");
  }
  if (!visitorId || visitorId.length > 128) {
    throw new BadRequestError("visitorId invalide");
  }

  await prisma.page_view.create({
    data: {
      path,
      visitor_id: visitorId,
      referrer: hostFromReferrer(input.referrer),
      user_agent: input.userAgent ? input.userAgent.slice(0, 300) : null,
      device: inferDevice(input.userAgent),
    },
  });
}

export async function getDashboardSummary(rangeDays = 30): Promise<DashboardSummary> {
  const days = Number.isFinite(rangeDays)
    ? Math.min(90, Math.max(1, Math.trunc(rangeDays)))
    : 30;

  const now = new Date();
  const since = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - (days - 1),
    ),
  );

  const views = await prisma.page_view.findMany({
    where: { created_at: { gte: since } },
    select: {
      created_at: true,
      visitor_id: true,
      path: true,
      referrer: true,
      device: true,
    },
  });

  const totalViews = views.length;
  const uniqueVisitors = new Set(views.map((v) => v.visitor_id)).size;

  const byDay = new Map<string, { views: number; visitors: Set<string> }>();
  const byPath = new Map<string, { views: number; visitors: Set<string> }>();
  const byReferrer = new Map<string, number>();
  const byDevice = new Map<string, number>();

  for (const v of views) {
    const dayKey = v.created_at.toISOString().slice(0, 10);
    let dayBucket = byDay.get(dayKey);
    if (!dayBucket) {
      dayBucket = { views: 0, visitors: new Set() };
      byDay.set(dayKey, dayBucket);
    }
    dayBucket.views += 1;
    dayBucket.visitors.add(v.visitor_id);

    let pathBucket = byPath.get(v.path);
    if (!pathBucket) {
      pathBucket = { views: 0, visitors: new Set() };
      byPath.set(v.path, pathBucket);
    }
    pathBucket.views += 1;
    pathBucket.visitors.add(v.visitor_id);

    if (v.referrer) {
      byReferrer.set(v.referrer, (byReferrer.get(v.referrer) ?? 0) + 1);
    }

    const deviceKey = v.device ?? "desktop";
    byDevice.set(deviceKey, (byDevice.get(deviceKey) ?? 0) + 1);
  }

  const dailySeries: DailyPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    dailySeries.push({
      date: key,
      views: bucket?.views ?? 0,
      visitors: bucket?.visitors.size ?? 0,
    });
  }

  const viewsPerDay = totalViews === 0 ? 0 : Number((totalViews / days).toFixed(1));

  const topPages = [...byPath.entries()]
    .map(([path, b]) => ({ path, views: b.views, visitors: b.visitors.size }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const topReferrers = [...byReferrer.entries()]
    .map(([referrer, count]) => ({ referrer, views: count }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const deviceBreakdown = [...byDevice.entries()]
    .map(([device, count]) => ({ device, views: count }))
    .sort((a, b) => b.views - a.views);

  const [applications, spontaneousApplications, contactMessages, unreadContactMessages] =
    await Promise.all([
      prisma.application.count({ where: { submitted_at: { gte: since } } }),
      prisma.spontaneous_application.count({ where: { submitted_at: { gte: since } } }),
      prisma.contact_message.count({ where: { submitted_at: { gte: since } } }),
      prisma.contact_message.count({ where: { submitted_at: { gte: since }, is_read: false } }),
    ]);

  return {
    rangeDays: days,
    totalViews,
    uniqueVisitors,
    viewsPerDay,
    dailySeries,
    topPages,
    topReferrers,
    deviceBreakdown,
    counts: {
      applications,
      spontaneousApplications,
      contactMessages,
      unreadContactMessages,
    },
  };
}
