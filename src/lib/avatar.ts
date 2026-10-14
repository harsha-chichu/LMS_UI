/**
 * Turns a picked photo into a small square avatar in the browser before upload:
 * centre-cropped, 256×256, WebP (JPEG where the browser can't encode WebP).
 * Keeps uploads tiny and fast, and strips the original's metadata.
 */

const AVATAR_SIZE = 256;
const MAX_INPUT_BYTES = 10 * 1024 * 1024;

export class AvatarError extends Error {}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function resizeAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new AvatarError("pick an image file.");
  if (file.size > MAX_INPUT_BYTES) throw new AvatarError("that photo is over 10 MB — pick a smaller one.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarError("couldn't read that image — try a jpg or png.");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AvatarError("couldn't process that image.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  bitmap.close();

  // Safari can't encode WebP and quietly returns PNG; use JPEG there instead.
  const webp = await toBlob(canvas, "image/webp", 0.85);
  const blob = webp?.type === "image/webp" ? webp : await toBlob(canvas, "image/jpeg", 0.88);
  if (!blob) throw new AvatarError("couldn't process that image.");
  return blob;
}
