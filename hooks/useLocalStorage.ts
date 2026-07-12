import { useCallback, useEffect, useState } from 'react';

/**
 * Persists a value to localStorage (browser only — this is a real
 * deployed Next.js app, not a Claude artifact, so localStorage is fine).
 * Used primarily for the user's own Gemini API key (see types/api.ts
 * ProcessRequest.geminiKey) so they don't have to re-enter it per session.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) setValue(JSON.parse(stored) as T);
    } catch {
      // ignore malformed/unavailable storage
    } finally {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage unavailable (private browsing, quota) — value still
        // updates in memory for this session
      }
    },
    [key],
  );

  const clear = useCallback(() => {
    setValue(initialValue);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, [key, initialValue]);

  return { value, set, clear, hydrated };
}
