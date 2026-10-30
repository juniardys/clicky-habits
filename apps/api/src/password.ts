// Password rule shared by every password the API accepts directly.
// Mirrors better-auth's default minPasswordLength (8) / maxPasswordLength (128).
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export type PasswordError = "password_too_short" | "password_too_long";

export function validatePassword(pw: unknown): PasswordError | null {
  if (typeof pw !== "string" || pw.length < PASSWORD_MIN) return "password_too_short";
  if (pw.length > PASSWORD_MAX) return "password_too_long";
  return null;
}
