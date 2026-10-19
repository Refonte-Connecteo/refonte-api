import { logger } from "../lib/logger.js";

const IS_TEST = process.env.VITEST === "true" || process.env.NODE_ENV === "test";

const INTERVAL_MS = 9 * 60 * 1000; // 9 minutes

let timer: NodeJS.Timeout | null = null;

async function ping(): Promise<void> {
  const port = process.env.PORT || 3000;
  const url = `http://localhost:${port}/health`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn({ status: res.status }, "Keep-alive ping: réponse non OK");
    } else {
      logger.info("Keep-alive ping: serveur en vie");
    }
  } catch (err) {
    logger.error(err, "Keep-alive ping: échec");
  }
}

export function startKeepAliveJob(): void {
  if (IS_TEST) return;
  if (timer) return;
  timer = setInterval(() => void ping(), INTERVAL_MS);
  logger.info("Keep-alive job démarré (intervalle: 9 min)");
}

export function stopKeepAliveJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
