import { useEffect, useRef, useState } from "react";

const VALIDATION_MS = 100;
const DEBOUNCE_MS = 1500;
const MAX_WAIT_MS = 5000;

type Validation<T> =
  | { value: T; error?: never }
  | { error: string; value?: never };

export function useNodeConfigAutoSave<T>(
  draftKey: string,
  dirty: boolean,
  validate: () => Validation<T>,
  apply: (value: T) => T,
) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const pendingSince = useRef<number | null>(null);
  const scheduled = useRef<number[]>([]);
  const current = useRef({ dirty, validate, apply });
  current.current = { dirty, validate, apply };

  function clearTimers() {
    scheduled.current.forEach((timer) => window.clearTimeout(timer));
    scheduled.current = [];
  }

  function flush(applyDefaults = false): T | null {
    clearTimers();
    const result = current.current.validate();
    if (result.error !== undefined) {
      pendingSince.current = null;
      setError(result.error);
      setStatus("設定有誤");
      return null;
    }
    try {
      let value = result.value;
      if (current.current.dirty || applyDefaults) {
        value = current.current.apply(value);
        setStatus("設定已套用");
      }
      setError("");
      pendingSince.current = null;
      return value;
    } catch (cause) {
      pendingSince.current = null;
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("設定尚未套用");
      return null;
    }
  }

  useEffect(() => {
    if (!dirty) {
      pendingSince.current = null;
      setError("");
      setStatus((previous) => (previous === "設定已套用" ? previous : ""));
      return;
    }
    const now = performance.now();
    pendingSince.current ??= now;
    setStatus("待自動套用");
    scheduled.current = [
      window.setTimeout(() => {
        const result = current.current.validate();
        setError(result.error ?? "");
        if (result.error !== undefined) setStatus("設定有誤");
      }, VALIDATION_MS),
      window.setTimeout(
        () => flush(),
        Math.min(
          DEBOUNCE_MS,
          Math.max(0, pendingSince.current + MAX_WAIT_MS - now),
        ),
      ),
    ];
    return clearTimers;
  }, [draftKey, dirty]);

  return { flush, status, error };
}
