// Visit and usage counts via GoatCounter (https://movierank.goatcounter.com): no cookies,
// no personal data. The script tag in index.html counts page loads; this adds events for
// what people do inside the single-page site.

declare global {
  interface Window {
    goatcounter?: { count?: (vars: { path: string; title?: string; event?: boolean }) => void };
  }
}

/** Counts an event, e.g. "tab/stats" or "open/Inception". Does nothing until the script has loaded. */
export function track(path: string, title?: string) {
  try {
    window.goatcounter?.count?.({ path, title: title ?? path, event: true });
  } catch {
    // Analytics must never break the site.
  }
}

/** The owner's own visits shouldn't count: GoatCounter skips browsers with this flag. */
export function excludeThisBrowser(exclude: boolean) {
  try {
    if (exclude) localStorage.setItem('skipgc', 't');
    else localStorage.removeItem('skipgc');
  } catch {
    // Storage unavailable.
  }
}
