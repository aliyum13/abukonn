// Cloudinary delivery optimization — ported from web/src/lib/image.ts.
//
// Images uploaded to ABUkonn are stored on Cloudinary at full resolution — a
// student's phone photo can be several megabytes. Serving that raw on mobile
// (feed post images, story images) is the main cause of slow loading, exactly
// as it was on web before this same fix was applied there.
//
// This helper injects Cloudinary transformation parameters into the delivery
// URL so Cloudinary returns a compressed, right-sized, modern-format image:
//   f_auto        → best format the device supports (WebP/AVIF)
//   q_auto        → smart quality/compression
//   w_<n>,c_limit → cap the width (never upscale)
//   dpr_auto      → serve retina where the screen needs it
// Cloudinary generates each derived image once, then caches it at the CDN
// edge, so every subsequent view is fast.

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

// Same problem as images, worse in practice: a post video is served at
// whatever resolution/bitrate the phone camera recorded it at, with zero
// compression, so expo-video's player has to buffer the full raw file before
// playback can even start. f_auto/q_auto apply the same way to video as to
// images (best codec/container, smart bitrate); the width cap is lower than
// optimizedImage's default (720 vs 1080) since video payload size scales
// with resolution far more steeply than a static image's does, and dpr_auto
// is dropped -- it's a retina-display concept that doesn't carry over to
// video the way it does a still image.
export function optimizedVideo(
  url: string | null | undefined,
  width = 720,
): string {
  if (!url) return '';
  if (!url.includes('/upload/')) return url;
  if (url.includes('/upload/f_auto') || url.includes('/upload/q_auto')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_limit/`);
}
