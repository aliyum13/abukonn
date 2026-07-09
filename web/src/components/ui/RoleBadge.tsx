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

/**
 * Verified badge — a blue check shown next to a verified user's name anywhere
 * in the app. Driven by the is_verified flag (independent of role), granted by
 * admins. Renders nothing when the user isn't verified.
 */
export function VerifiedBadge({ verified, className }: { verified?: boolean; className?: string }) {
  if (!verified) return null;
  return (
    <span
      title="Verified"
      className={cn('inline-flex items-center justify-center align-middle text-blue-500', className)}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-label="Verified">
        <path d="M12 2l2.4 1.8 3-.3 1 2.8 2.6 1.5-.9 2.9.9 2.9-2.6 1.5-1 2.8-3-.3L12 22l-2.4-1.8-3 .3-1-2.8L3 16.2l.9-2.9L3 10.4l2.6-1.5 1-2.8 3 .3L12 2z" />
        <path d="M10.6 14.6l-2.2-2.2 1.1-1.1 1.1 1.1 3-3 1.1 1.1-4.1 4.1z" fill="#fff" />
      </svg>
    </span>
  );
}

/**
 * Content-creator badge — marks students designated as content creators
 * (past questions, notes, announcements) per the growth strategy. Driven by
 * the is_content_creator flag, granted by admins.
 */
export function ContentCreatorBadge({
  isCreator,
  className,
  iconOnly = false,
}: {
  isCreator?: boolean;
  className?: string;
  iconOnly?: boolean;
}) {
  if (!isCreator) return null;
  return (
    <span
      title="Content Creator"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400',
        className
      )}
    >
      <span>✎</span>
      {!iconOnly && <span>Creator</span>}
    </span>
  );
}
