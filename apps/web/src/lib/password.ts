// Same length rule as the API (apps/api/src/password.ts). The apps share no
// package, so keep both in sync.
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 128;

export type NewPasswordError = "password_too_short" | "password_too_long" | "password_mismatch";

export function validateNewPassword(pw: string, confirm: string): NewPasswordError | null {
  if (pw.length < PASSWORD_MIN) return "password_too_short";
  if (pw.length > PASSWORD_MAX) return "password_too_long";
  if (pw !== confirm) return "password_mismatch";
  return null;
}
