"use client";

import { useCallback, useEffect, useState } from "react";

export type ListUrlState = Record<string, string>;

function readInitial<T extends ListUrlState>(defaults: T): T {
  if (typeof window === "undefined") return defaults;
  const params = new URLSearchParams(window.location.search);
  const next = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const raw = params.get(key);
    if (raw != null) next[key as keyof T] = raw as T[keyof T];
  }
  return next;
}

function writeToUrl<T extends ListUrlState>(values: T, defaults: T): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  for (const key of Object.keys(defaults)) {
    const value = values[key];
    if (!value || value === defaults[key]) params.delete(key);
    else params.set(key, value);
  }
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  if (next === `${window.location.pathname}${window.location.search}`) return;
  window.history.replaceState(window.history.state, "", next);
}

/**
 * Keeps list filters in component state and mirrors them onto the URL, so a
 * reload or a return from a detail page restores what the user was looking at.
 * Uses `history.replaceState` rather than the router so typing in a search box
 * does not trigger a navigation per keystroke.
 */
export function useListUrlState<T extends ListUrlState>(defaults: T) {
  const [frozenDefaults] = useState(defaults);
  const [values, setValues] = useState<T>(() => readInitial(frozenDefaults));

  useEffect(() => {
    writeToUrl(values, frozenDefaults);
  }, [values, frozenDefaults]);

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const patch = useCallback((next: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...next }));
  }, []);

  const reset = useCallback(() => {
    setValues(frozenDefaults);
  }, [frozenDefaults]);

  const isDefault = Object.keys(frozenDefaults).every(
    (key) => values[key] === frozenDefaults[key],
  );

  return { values, setValue, patch, reset, isDefault };
}
