// Turns a picture chosen in the admin form into a compact JPEG data URL.
// The backend stores it as-is in products.image_url, so the photo lives in
// the database and needs no separate file server.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // size of the original file
const MAX_SIDE = 1000; // longest edge after resizing, in pixels
const QUALITY = 0.85;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const ACCEPT_ATTR = ACCEPTED.join(',');

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This file could not be read as an image.'));
    };
    img.src = url;
  });
}

export async function fileToImageData(file) {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Please choose a JPEG, PNG, WebP or GIF picture.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('That picture is larger than 10 MB. Please choose a smaller one.');
  }

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // JPEG has no transparency, so paint a white background first.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', QUALITY);
}
