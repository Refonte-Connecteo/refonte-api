/**
 * Détection du type de fichier par son contenu (magic bytes).
 *
 * L'extension déclarée par le client est NON fiable : on inspecte les
 * premiers octets du fichier pour déterminer son vrai type, puis on
 * vérifie la cohérence extension <-> contenu côté serveur.
 */

export type DetectedFileKind = "jpeg" | "png" | "webp" | "gif" | "pdf" | "docx" | "doc";

export const IMAGE_FILE_KINDS: DetectedFileKind[] = ["jpeg", "png", "webp", "gif"];
export const CV_FILE_KINDS: DetectedFileKind[] = ["pdf", "docx", "doc"];
export const ALL_FILE_KINDS: DetectedFileKind[] = [...IMAGE_FILE_KINDS, ...CV_FILE_KINDS];

const KIND_EXTENSIONS: Record<DetectedFileKind, string[]> = {
  jpeg: ["jpg", "jpeg"],
  png: ["png"],
  webp: ["webp"],
  gif: ["gif"],
  pdf: ["pdf"],
  docx: ["docx"],
  doc: ["doc"],
};

const KIND_MIME: Record<DetectedFileKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

export function extensionsForKind(kind: DetectedFileKind): string[] {
  return KIND_EXTENSIONS[kind];
}

export function canonicalExtensionForKind(kind: DetectedFileKind): string {
  return KIND_EXTENSIONS[kind][0];
}

export function mimeForKind(kind: DetectedFileKind): string {
  return KIND_MIME[kind];
}

function isZipDocx(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  const head = buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!head) return false;
  const version = buffer[2];
  if (version !== 0x03 && version !== 0x05 && version !== 0x07) return false;
  const hasWord = buffer.includes(Buffer.from("word/")) || buffer.includes(Buffer.from("Word/"));
  const hasContentTypes = buffer.includes(Buffer.from("[Content_Types].xml"));
  return hasWord || hasContentTypes;
}

const SIGNATURES: Array<{ kind: DetectedFileKind; test: (b: Buffer) => boolean }> = [
  {
    kind: "jpeg",
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    kind: "png",
    test: (b) =>
      b.length >= 8 &&
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    kind: "webp",
    test: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
  {
    kind: "gif",
    test: (b) =>
      b.length >= 6 &&
      (b.subarray(0, 6).toString("ascii") === "GIF87a" ||
        b.subarray(0, 6).toString("ascii") === "GIF89a"),
  },
  {
    kind: "pdf",
    test: (b) => b.length >= 5 && b.subarray(0, 5).toString("ascii") === "%PDF-",
  },
  { kind: "docx", test: isZipDocx },
  {
    kind: "doc",
    test: (b) =>
      b.length >= 8 &&
      b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  },
];

/** Retourne le type détecté par le contenu, ou null si aucun magic bytes connu. */
export function detectFileKind(buffer: Buffer): DetectedFileKind | null {
  for (const signature of SIGNATURES) {
    if (signature.test(buffer)) {
      return signature.kind;
    }
  }
  return null;
}
