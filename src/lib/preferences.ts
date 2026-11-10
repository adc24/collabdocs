// Browser preferences are optional; PostgreSQL is always authoritative.
// Access can fail in restricted/private contexts, so it must never block sign-in.
export const preferences = {
  get(key: string): string | null {
    try {
      return typeof window !== "undefined"
        ? window.localStorage.getItem(key)
        : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      if (typeof window !== "undefined")
        window.localStorage.setItem(key, value);
    } catch {}
  },
  remove(key: string): void {
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(key);
    } catch {}
  },
};
