const supportedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

const mimeByExtension: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};

export const SUPPORTED_UPLOAD_ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.pdf,image/png,image/jpeg,image/gif,image/webp,application/pdf";

export async function readUploadDataUrl(file: File): Promise<string> {
  if (file.size > 700_000) throw new Error("الحد الأقصى للمرفق 700 كيلوبايت");

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = supportedMimeTypes.has(file.type)
    ? file.type
    : (!file.type || file.type === "application/octet-stream")
      ? mimeByExtension[extension]
      : undefined;
  if (!mimeType) throw new Error("نوع الملف غير مدعوم. ارفع صورة PNG أو JPG أو GIF أو WebP أو ملف PDF.");

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("تعذر قراءة الملف"));
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });

  const payload = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return `data:${mimeType};base64,${payload}`;
}
