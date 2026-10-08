import { type TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

// Multi-line sibling of Input, with the same surface, text, border and
// placeholder colours in both themes. Use it instead of a bare <textarea> with a
// hand-written class string: a hard-coded `bg-white` next to the `text-ink`
// token is near-white-on-white in dark mode (the token flips, the hard-coded
// background doesn't), which is how the News "Content" box became unreadable.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="mb-1.5 block text-label text-ink-secondary"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full px-3.5 py-2.5 rounded-xl border bg-surface text-body-sm text-ink',
            'placeholder:text-ink-muted transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
            'dark:bg-[#1a1a1a] dark:border-[#333] dark:text-[#f5f5f5] dark:placeholder:text-[#666]',
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : 'border-border hover:border-border-strong',
            'disabled:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60',
            className
          )}
          {...props}
        />
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

Textarea.displayName = 'Textarea';
