import { type SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, id, children, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-label text-ink-secondary"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full h-10 px-3.5 rounded-xl border bg-surface text-body-sm text-ink',
            'transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
            'dark:bg-[#1a1a1a] dark:border-[#333] dark:text-[#f5f5f5]',
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : 'border-border hover:border-border-strong',
            'disabled:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="mt-1.5 text-caption text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-caption text-ink-muted">{hint}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
