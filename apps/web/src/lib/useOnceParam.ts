import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

// Reads a one-shot flag like ?verified=1 (set by an email link redirect),
// then removes it from the URL so a reload does not show the notice again.
export function useOnceParam(name: string): boolean {
  const [params, setParams] = useSearchParams();
  const [seen, setSeen] = useState(() => params.get(name) === "1");

  useEffect(() => {
    if (params.get(name) === null) return;
    if (params.get(name) === "1") setSeen(true);
    const next = new URLSearchParams(params);
    next.delete(name);
    setParams(next, { replace: true });
  }, [name, params, setParams]);

  return seen;
}
