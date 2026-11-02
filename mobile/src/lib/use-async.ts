import { useFocusEffect } from "expo-router";
import { type DependencyList, useCallback, useEffect, useRef, useState } from "react";

type AsyncState<T> = {
  data: T | undefined;
  error: boolean;
  loading: boolean;
  reload: () => Promise<void>;
};

// Runs `load` when the deps change, keeps the last good data while
// reloading, and (with refetchOnFocus) runs again when the screen regains
// focus, so lists stay fresh after a change made on another screen.
export function useAsync<T>(
  load: () => Promise<T>,
  deps: DependencyList,
  { refetchOnFocus = false }: { refetchOnFocus?: boolean } = {},
): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const run = useRef(0);
  const loader = useRef(load);
  // Always call the newest `load` (it may close over new props).
  useEffect(() => {
    loader.current = load;
  });

  const reload = useCallback(async () => {
    const id = ++run.current;
    setLoading(true);
    try {
      const result = await loader.current();
      if (id === run.current) {
        setData(result);
        setError(false);
      }
    } catch (e) {
      console.warn("load failed", e);
      if (id === run.current) setError(true);
    } finally {
      if (id === run.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetching when the deps change is this hook's job.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    // The caller's deps decide when to load again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (refetchOnFocus) void reload();
    }, [refetchOnFocus, reload]),
  );

  return { data, error, loading, reload };
}
