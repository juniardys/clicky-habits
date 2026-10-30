export type LinkResult = "ok" | "error" | null;

// Email links redirect to a callbackURL that already carries a success flag
// (e.g. ?verified=1). On a bad or expired link better-auth appends
// ?error=<CODE> to that same URL, so the flag alone does not mean success.
export function linkResult(params: URLSearchParams, flag: string): LinkResult {
  if (params.get(flag) !== "1") return null;
  return params.has("error") ? "error" : "ok";
}
