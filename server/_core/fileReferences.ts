const DATA_FILE_PATTERN = /^data:(?:image\/(?:png|jpeg|gif|webp)|application\/pdf);base64,[A-Za-z0-9+/]*={0,2}$/i;

export function isSafeFileReference(value: string): boolean {
  if (value === "") return true;
  if (DATA_FILE_PATTERN.test(value)) return true;
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
