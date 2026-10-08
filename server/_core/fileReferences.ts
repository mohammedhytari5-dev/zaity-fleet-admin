const DATA_FILE_PATTERN = /^data:(image\/(?:png|jpeg|gif|webp)|application\/pdf);base64,([A-Za-z0-9+/]*={0,2})$/i;
const MAX_FILE_BYTES = 700_000;

function contentMatchesMimeType(mimeType: string, bytes: Buffer): boolean {
  switch (mimeType.toLowerCase()) {
    case "image/png":
      return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/gif":
      return bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6));
    case "image/webp":
      return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    case "application/pdf":
      return bytes.length >= 5 && bytes.toString("ascii", 0, 5) === "%PDF-";
    default:
      return false;
  }
}

export function isSafeFileReference(value: string): boolean {
  if (value === "") return true;
  const dataFile = DATA_FILE_PATTERN.exec(value);
  if (dataFile) {
    const mimeType = dataFile[1];
    const payload = dataFile[2];
    if (payload.length % 4 !== 0) return false;
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    const size = payload.length / 4 * 3 - padding;
    if (size > MAX_FILE_BYTES) return false;
    const bytes = Buffer.from(payload, "base64");
    return bytes.toString("base64") === payload && contentMatchesMimeType(mimeType, bytes);
  }
  if (value.startsWith("/manus-storage/")) {
    const key = value.slice("/manus-storage/".length);
    return Boolean(key) && !key.split("/").some(part => part === "." || part === "..") && /^[A-Za-z0-9._/-]+$/.test(key);
  }
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
