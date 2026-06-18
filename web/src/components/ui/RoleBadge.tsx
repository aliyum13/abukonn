import { cn } from '@/lib/utils';

export type UserRole = 'user' | 'verified' | 'bod' | 'influencer' | 'admin';

interface RoleBadgeProps {
  role: UserRole | string;
  className?: string;
  /** show only the icon without text */
  iconOnly?: boolean;
}

export function RoleBadge({ role, className, iconOnly = false }: RoleBadgeProps) {
  if (!role || role === 'user') return null;

  const configs: Record<string, { label: string; icon: string; cls: string }> = {
    verified: {
      label: 'Verified',
      icon: '✓',
      cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    },
    bod: {
      label: 'BOD',
      icon: '★',
      cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
    },
    influencer: {
      label: 'Influencer',
      icon: '⭐',
      cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
    },
    admin: {
      label: 'Admin',
      icon: '🛡',
      cls: 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-400',
    },
  };

  const cfg = configs[role];
  if (!cfg) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        cfg.cls,
        className
      )}
    >
      <span>{cfg.icon}</span>
      {!iconOnly && <span>{cfg.label}</span>}
    </span>
  );
}

/** Returns true if this role uses follow (one-way) rather than connect (mutual) */
export function usesFollowSystem(role: string): boolean {
  return ['verified', 'bod', 'influencer', 'admin'].includes(role);
}
