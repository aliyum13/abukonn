import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-label text-ink-secondary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full h-10 px-3.5 rounded-xl border bg-white text-body-sm text-ink',
            'placeholder:text-ink-muted transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : 'border-border hover:border-border-strong',
            'disabled:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-caption text-red-600" role="alert">
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

Input.displayName = 'Input';
