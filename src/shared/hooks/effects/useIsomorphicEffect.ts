import { useEffect, useLayoutEffect } from "react";

/**
 * A custom hook that uses `useLayoutEffect` on the client-side and `useEffect` on the server-side.
 * This is useful for preventing SSR warnings when using `useLayoutEffect` in environments like Next.js.
 *
 * @remarks
 * `useLayoutEffect` can cause warnings during server-side rendering (SSR) because it relies on the DOM being available.
 * This hook dynamically switches between `useLayoutEffect` and `useEffect` based on whether the `document` object is available.
 *
 * @example
 * ```tsx
 * useIsomorphicEffect(() => {
 *   // Your effect logic here
 * }, []);
 * ```
 */
export const useIsomorphicEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;