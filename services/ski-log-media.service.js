/**
 * Crew Log photos — re-encode uploads (strips EXIF/GPS) into a display JPEG and a thumbnail.
 * Development work by David Lane
 */
import sharp from 'sharp';

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const DISPLAY_PX = 1600;
const THUMB_PX = 480;

export async function processPhotoBuffer(buffer) {
  if (!buffer?.length) throw Object.assign(new Error('No photo received.'), { status: 400 });
  let meta;
  try {
    meta = await sharp(buffer, { failOn: 'error' }).metadata();
  } catch {
    throw Object.assign(new Error('That file is not a photo we can read. Try a JPEG.'), { status: 400 });
  }
  if (!meta.width || !meta.height) throw Object.assign(new Error('That photo has no size.'), { status: 400 });
  const base = sharp(buffer).rotate();
  const { data: jpeg, info } = await base
    .clone()
    .resize(DISPLAY_PX, DISPLAY_PX, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const thumb = await base
    .clone()
    .resize(THUMB_PX, THUMB_PX, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 76, mozjpeg: true })
    .toBuffer();
  return { jpeg, thumb, width: info.width, height: info.height };
}

export default { MAX_PHOTO_BYTES, processPhotoBuffer };
