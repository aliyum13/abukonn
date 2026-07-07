import { cn } from '@/lib/utils';
import { optimizedAvatar } from '@/lib/image';

const sizes = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
} as const;

// Pixel size to request from Cloudinary per avatar size (2x for retina).
const pixelSizes: Record<keyof typeof sizes, number> = {
  xs: 48,
  sm: 64,
  md: 80,
  lg: 96,
  xl: 128,
};

export type AvatarSize = keyof typeof sizes;

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  className?: string;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ src, alt, name = '', size = 'md', className }: AvatarProps) {
  const initials = getInitials(name || alt || '?');

  if (src) {
    return (
      <div
        className={cn(
          'relative shrink-0 overflow-hidden rounded-full ring-2 ring-surface dark:ring-[#111]',
          sizes[size],
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={optimizedAvatar(src, pixelSizes[size])}
          alt={alt || name || 'Avatar'}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'bg-brand-100 font-semibold text-brand-700 ring-2 ring-surface dark:ring-[#111]',
        'dark:bg-brand-950 dark:text-brand-300',
        sizes[size],
        className
      )}
      aria-label={alt || name || 'Avatar'}
    >
      {initials || '?'}
    </div>
  );
}
