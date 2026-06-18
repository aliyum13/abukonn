'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Toggle } from './Toggle';

interface ThemeToggleRowProps {
  className?: string;
}

/** Dark mode switch — uses next-themes, stays in sync app-wide */
export function ThemeToggleRow({ className }: ThemeToggleRowProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className={cn('flex items-center justify-between gap-4', className)}>
        <div>
          <p className="text-[14px] font-medium text-ink">Dark mode</p>
          <p className="text-[13px] text-ink-muted">Use a dark colour scheme</p>
        </div>
        <div className="h-6 w-11 rounded-full bg-gray-200 dark:bg-[#333]" />
      </div>
    );
  }

  const dark = resolvedTheme === 'dark';

  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div>
        <p className="text-[14px] font-medium text-ink">Dark mode</p>
        <p className="text-[13px] text-ink-muted">Use a dark colour scheme across ABUkonn</p>
      </div>
      <Toggle checked={dark} onChange={(on) => setTheme(on ? 'dark' : 'light')} label="Toggle dark mode" />
    </div>
  );
}
