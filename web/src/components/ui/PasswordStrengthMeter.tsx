import { cn } from '@/lib/utils';

export const COMMON_PASSWORDS = new Set([
  'password','password123','123456','12345678','123456789',
  'qwerty','abc123','letmein','welcome','monkey','dragon',
  'master','iloveyou','sunshine','princess','football',
  'shadow','superman','michael','charlie',
]);

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password || password.length < 6) return 'weak';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'weak';

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const hasLetter = /[a-zA-Z]/.test(password);
  const long = password.length >= 8;

  if (long && hasUpper && hasLower && hasDigit && hasSymbol) return 'strong';
  if (long && hasLetter && hasDigit) return 'good';
  if (password.length >= 6 && (hasLetter || hasDigit)) return 'fair';
  return 'weak';
}

const LEVELS: Record<PasswordStrength, { label: string; color: string; bars: number }> = {
  weak:   { label: 'Weak',   color: 'bg-red-500',    bars: 1 },
  fair:   { label: 'Fair',   color: 'bg-orange-400', bars: 2 },
  good:   { label: 'Good',   color: 'bg-yellow-400', bars: 3 },
  strong: { label: 'Strong', color: 'bg-green-500',  bars: 4 },
};

const LABEL_COLORS: Record<PasswordStrength, string> = {
  weak:   'text-red-600 dark:text-red-400',
  fair:   'text-orange-600 dark:text-orange-400',
  good:   'text-yellow-600 dark:text-yellow-500',
  strong: 'text-green-600 dark:text-green-400',
};

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const strength = getPasswordStrength(password);
  const { label, color, bars } = LEVELS[strength];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-300',
              i <= bars ? color : 'bg-border dark:bg-[#2a2a2a]'
            )}
          />
        ))}
      </div>
      <p className={cn('text-[12px] font-medium', LABEL_COLORS[strength])}>
        {label}
      </p>
    </div>
  );
}
