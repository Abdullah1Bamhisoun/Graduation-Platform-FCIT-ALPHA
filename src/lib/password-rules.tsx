import { CheckCircle2, Circle } from 'lucide-react';

export interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: 'At least 8 characters',          test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter (A–Z)',      test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter (a–z)',      test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number (0–9)',                test: (pw) => /[0-9]/.test(pw) },
  { label: 'One special character (!@#$…)',   test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export function validatePassword(pw: string): string {
  if (!pw) return 'Password is required';
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(pw)) return `Password must include: ${rule.label.toLowerCase()}`;
  }
  return '';
}

export function PasswordRules({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className="mt-2 space-y-1">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-green-600' : 'text-[var(--color-text-500)]'}`}
          >
            {ok
              ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-500" />
              : <Circle className="w-3.5 h-3.5 shrink-0 text-[var(--color-border)]" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
