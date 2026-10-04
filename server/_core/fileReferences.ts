const DATA_FILE_PATTERN = /^data:(?:image\/(?:png|jpeg|gif|webp)|application\/pdf);base64,([A-Za-z0-9+/]*={0,2})$/i;
const MAX_FILE_BYTES = 700_000;

export function isSafeFileReference(value: string): boolean {
  if (value === "") return true;
  const dataFile = DATA_FILE_PATTERN.exec(value);
  if (dataFile) {
    const payload = dataFile[1];
    if (payload.length % 4 !== 0) return false;
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    return payload.length / 4 * 3 - padding <= MAX_FILE_BYTES;
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
