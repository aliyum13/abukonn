// Cloudinary delivery optimization.
//
// Images uploaded to ABUkonn are stored on Cloudinary at full resolution — a
// student's phone photo can be several megabytes. Serving that raw is the main
// cause of slow loading, especially for small elements like avatars.
//
// This helper injects Cloudinary transformation parameters into the delivery
// URL so Cloudinary returns a compressed, right-sized, modern-format image:
//   f_auto   → best format the browser supports (WebP/AVIF)
//   q_auto   → smart quality/compression
//   w_<n>,c_limit → cap the width (never upscale)
//   dpr_auto → serve retina where the screen needs it
// Cloudinary generates each derived image once, then caches it at the CDN edge,
// so every subsequent view is fast.

export function optimizedImage(
  url: string | null | undefined,
  width = 1080,
): string {
  if (!url) return '';
  // Only transform Cloudinary URLs
  if (!url.includes('/upload/')) return url;
  // Don't double-transform if params are already present
  if (url.includes('/upload/f_auto') || url.includes('/upload/q_auto')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_limit,dpr_auto/`);
}

// Small square crop for avatars/thumbnails — fills a fixed circle/box, so we
// crop to fill (c_fill) at the target pixel size rather than limiting width.
export function optimizedAvatar(
  url: string | null | undefined,
  size = 96,
): string {
  if (!url) return '';
  if (!url.includes('/upload/')) return url;
  if (url.includes('/upload/f_auto') || url.includes('/upload/q_auto')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${size},h_${size},c_fill,g_face,dpr_auto/`);
}
