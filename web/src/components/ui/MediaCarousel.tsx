'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { optimizedImage } from '@/lib/image';

export interface MediaItem {
  id: number;
  media_url: string;
  media_type: 'image' | 'video';
  thumbnail_url: string | null;
  duration_seconds: number | null;
  position: number;
}

// Renders a post's media[] (Pro multi-media: 1-3 images/video, any mix).
// Shared between the feed and the single-post detail page — both display
// posts and both need this, so it lives here rather than being duplicated.
//
// A single item renders full-width like the legacy image_url did; 2-3 items
// become a horizontally-scrollable, snap-to strip with dot indicators, so it
// works the same on trackpad-scroll and touch without a carousel library.
// Video uses a native <video> element (no extra dependency on web, unlike
// mobile) with its own controls; tapping an image opens the caller's
// lightbox, tapping a video does nothing extra (native controls already
// handle play/fullscreen).
export function MediaCarousel({
  items, onOpenImage,
}: {
  items: MediaItem[] | null | undefined;
  onOpenImage: (url: string) => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  const handleScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIdx(Math.max(0, Math.min(items.length - 1, idx)));
  };

  return (
    <div className="mt-3">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl border border-border/60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map(item => (
          <div key={item.id} className="w-full shrink-0 snap-center">
            {item.media_type === 'video' ? (
              <video
                src={item.media_url}
                poster={item.thumbnail_url || undefined}
                controls
                className="max-h-[500px] w-full bg-black object-contain"
              />
            ) : (
              <button type="button" onClick={e => { e.stopPropagation(); onOpenImage(item.media_url); }}
                className="block w-full">
                <img src={optimizedImage(item.media_url)} alt="Post media" loading="lazy"
                  className="max-h-[500px] w-full bg-black/5 object-contain transition hover:opacity-95 dark:bg-white/5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {items.map((item, i) => (
            <span key={item.id} className={cn(
              'h-1.5 rounded-full transition-all',
              i === activeIdx ? 'w-4 bg-brand-500' : 'w-1.5 bg-border',
            )} />
          ))}
        </div>
      )}
    </div>
  );
}
