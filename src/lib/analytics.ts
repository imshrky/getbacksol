"use client";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/**
 * Pushes a custom event to GTM's dataLayer — a no-op if NEXT_PUBLIC_GTM_ID
 * isn't configured (local dev, or before the container is set up), so
 * every call site can fire events unconditionally without checking whether
 * analytics is actually wired up.
 */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!GTM_ID || typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name, ...params });
}
