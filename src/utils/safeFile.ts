import path from "path";

function decodePercent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Construit un chemin d'accès fichier sûr à partir d'une entrée utilisateur.
 *
 * - Décode l'encodage URL et normalise les séparateurs Windows.
 * - Rejette toute tentative de path traversal (segment de points "..", "..." ,
 *   octet nul, chemin absolu) en retournant null.
 * - N'utilise que le basename de l'entrée (path.basename) pour éliminer toute
 *   remontée résiduelle dans l'arborescence.
 * - Vérifie que le chemin final résolu commence bien par `baseDir`.
 */
export function getSafeFilePath(baseDir: string, userInput: string): string | null {
  if (typeof userInput !== "string" || userInput.trim() === "") {
    return null;
  }

  const normalized = decodePercent(userInput).replace(/\\/g, "/");

  if (normalized.includes("\0")) {
    return null;
  }

  if (normalized.startsWith("/")) {
    return null;
  }

  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  if (segments.some((segment) => /^\.{2,}$/.test(segment))) {
    return null;
  }

  const base = path.resolve(baseDir);
  const filename = path.basename(normalized);

  if (!filename || filename === "." || filename === "..") {
    return null;
  }

  const fullPath = path.resolve(base, filename);

  if (fullPath !== base && !fullPath.startsWith(base + path.sep)) {
    return null;
  }

  return fullPath;
}
