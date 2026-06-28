import { type InputHTMLAttributes, forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  hint?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const [show, setShow] = useState(false);
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-label text-ink-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={show ? 'text' : 'password'}
            className={cn(
              'w-full h-10 pl-3.5 pr-10 rounded-xl border bg-surface text-body-sm text-ink',
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
          <button
            type="button"
            tabIndex={-1}
            aria-label={show ? 'Hide password' : 'Show password'}
            onClick={() => setShow(v => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-muted transition-colors hover:text-ink"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && (
          <p className="mt-1.5 text-caption text-red-600 dark:text-red-400" role="alert">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-caption text-ink-muted">{hint}</p>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
