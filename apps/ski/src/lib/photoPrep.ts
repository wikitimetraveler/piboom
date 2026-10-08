import exifr from 'exifr';

export interface PhotoMeta {
  takenAt: number | null;
  lat: number | null;
  lng: number | null;
}

/** Capture time and GPS from the photo itself. iPhone often strips GPS on upload, so both may be missing. */
export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  const out: PhotoMeta = { takenAt: null, lat: null, lng: null };
  try {
    const tags = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate']);
    const when: unknown = tags?.DateTimeOriginal || tags?.CreateDate;
    if (when instanceof Date && !Number.isNaN(when.getTime())) out.takenAt = when.getTime();
  } catch {
    /* no EXIF block */
  }
  try {
    const gps = await exifr.gps(file);
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
      out.lat = gps.latitude;
      out.lng = gps.longitude;
    }
  } catch {
    /* no GPS block */
  }
  return out;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not open that photo.'));
    };
    img.src = url;
  });
}

/** Downscale on the phone so uploads stay small on mountain cell service. */
export async function shrinkPhoto(file: File, maxPx = 1600): Promise<Blob> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    source = await loadImage(file);
  }
  const scale = Math.min(1, maxPx / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ('close' in source) source.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not shrink that photo.'))), 'image/jpeg', 0.85)
  );
}
