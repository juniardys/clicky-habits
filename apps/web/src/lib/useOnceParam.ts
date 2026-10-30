import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { linkResult, type LinkResult } from "./linkResult";

// Reads the outcome of an email link redirect like ?verified=1 (or
// ?verified=1&error=TOKEN_EXPIRED), then removes the flag and the error from
// the URL so a reload does not show the notice again.
export function useOnceParam(name: string): LinkResult {
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState<LinkResult>(() => linkResult(params, name));

  useEffect(() => {
    if (params.get(name) === null) return;
    const found = linkResult(params, name);
    if (found) setResult(found);
    const next = new URLSearchParams(params);
    next.delete(name);
    next.delete("error");
    setParams(next, { replace: true });
  }, [name, params, setParams]);

  return result;
}
