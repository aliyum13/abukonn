// Mirrors web's PasswordStrengthMeter logic exactly (getPasswordStrength +
// COMMON_PASSWORDS), so mobile registration enforces the same rules.
export const COMMON_PASSWORDS = new Set([
  'password', 'password123', '123456', '12345678', '123456789',
  'qwerty', 'abc123', 'letmein', 'welcome', 'monkey', 'dragon',
  'master', 'iloveyou', 'sunshine', 'princess', 'football',
  'shadow', 'superman', 'michael', 'charlie',
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

export const STRENGTH_META: Record<PasswordStrength, { label: string; color: string; bars: number }> = {
  weak:   { label: 'Weak',   color: '#ef4444', bars: 1 },
  fair:   { label: 'Fair',   color: '#fb923c', bars: 2 },
  good:   { label: 'Good',   color: '#facc15', bars: 3 },
  strong: { label: 'Strong', color: '#22c55e', bars: 4 },
};
