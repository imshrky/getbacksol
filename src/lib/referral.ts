"use client";

const STORAGE_KEY = "gbs_ref";
const VALID_REF = /^[a-z0-9-]{1,100}$/i;

/** Captures `?ref=<partnerId>` from the current URL into sessionStorage. */
export function captureReferral(): void {
  if (typeof window === "undefined") return;
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (ref && VALID_REF.test(ref)) {
    sessionStorage.setItem(STORAGE_KEY, ref);
  }
}

/** Reads back a previously captured partner attribution tag, if any. */
export function getReferral(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STORAGE_KEY);
}
