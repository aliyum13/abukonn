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

// Cloudinary Small PAYG caps VIDEO TRANSFORMATIONS at 300MB. Above this we
// must skip the transform entirely rather than request one that errors.
// Deliberately below the 400MB Pro upload ceiling -- the two limits are set
// by different things (our product tiers vs the Cloudinary plan) and are not
// meant to track each other.
export const VIDEO_TRANSFORM_MAX_BYTES = 300 * 1024 * 1024;

// Same problem as images, worse in practice: a post video is served at
// whatever resolution/bitrate the phone camera recorded it at, with zero
// compression, so the player has to buffer the full raw file before playback
// can even start. f_auto/q_auto apply the same way to video as to images
// (best codec/container the browser supports, smart bitrate); the width cap
// is lower than optimizedImage's default (720 vs 1080) since video payload
// size scales with resolution far more steeply than a static image's does,
// and dpr_auto is dropped -- it's a retina-display concept that doesn't
// carry over to video the way it does a still image.
export function optimizedVideo(
  url: string | null | undefined,
  width = 720,
  bytes?: number | null,
): string {
  if (!url) return '';
  if (!url.includes('/upload/')) return url;
  if (url.includes('/upload/f_auto') || url.includes('/upload/q_auto')) return url;
  // Cloudinary's Small PAYG plan refuses to TRANSFORM a video over 300MB, so
  // asking for f_auto,q_auto on one returns an error instead of a video. Our
  // Pro ceiling is 400MB, which leaves a 300-400MB band that would simply
  // fail to play. Serve those raw and unoptimised -- a big file that plays
  // beats a smaller one that doesn't.
  //
  // bytes is unknown (null/undefined) for anything uploaded before it was
  // recorded. Optimising those is safe: the old caps were 50MB free / 150MB
  // Pro, so every legacy video is comfortably under the transform limit.
  if (bytes != null && bytes > VIDEO_TRANSFORM_MAX_BYTES) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_limit/`);
}
