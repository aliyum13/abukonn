import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-surface-subtle text-ink-secondary dark:bg-[#1a1a1a] dark:text-[#a0a0a0]',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
  success: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  danger: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  outline: 'border border-border bg-surface text-ink-secondary dark:border-[#333] dark:bg-[#111] dark:text-[#a0a0a0]',
} as const;

export type BadgeVariant = keyof typeof variants;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
