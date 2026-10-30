/**
 * Per-user single-stream guard. `acquire` is synchronous on purpose: the
 * check-and-set must not span an `await`, or two concurrent requests for the
 * same user can both pass.
 */
export interface StreamGuard {
  acquire(userId: string): boolean;
  release(userId: string): void;
}

export function createStreamGuard(): StreamGuard {
  const active = new Set<string>();
  return {
    acquire(userId: string): boolean {
      if (active.has(userId)) return false;
      active.add(userId);
      return true;
    },
    release(userId: string): void {
      active.delete(userId);
    },
  };
}
