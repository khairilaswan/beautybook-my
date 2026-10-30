"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False during the server render and hydration, true afterwards. For values
// that depend on "now": the server render may be cached for hours.
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
