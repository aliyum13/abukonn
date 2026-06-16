import Image from 'next/image';
import { cn } from '@/lib/utils';

const sizes = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
} as const;

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
          'relative shrink-0 overflow-hidden rounded-full ring-2 ring-white',
          sizes[size],
          className
        )}
      >
        <Image
          src={src}
          alt={alt || name || 'Avatar'}
          fill
          className="object-cover"
          sizes="64px"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'bg-brand-100 font-semibold text-brand-700 ring-2 ring-white',
        sizes[size],
        className
      )}
      aria-label={alt || name || 'Avatar'}
    >
      {initials || '?'}
    </div>
  );
}
