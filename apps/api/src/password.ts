// Password rule shared by every password the API accepts directly.
// Kept simple on purpose (not a banking app). Also passed to better-auth as
// minPasswordLength; maxPasswordLength matches better-auth's default (128).
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 128;

export type PasswordError = "password_too_short" | "password_too_long";

export function validatePassword(pw: unknown): PasswordError | null {
  if (typeof pw !== "string" || pw.length < PASSWORD_MIN) return "password_too_short";
  if (pw.length > PASSWORD_MAX) return "password_too_long";
  return null;
}
