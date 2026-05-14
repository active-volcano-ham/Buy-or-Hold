/**
 * Native bridge for receiving shared URLs from the iOS Share Extension.
 *
 * The Share Extension writes incoming URLs to the App Group's shared
 * UserDefaults under key `SharedURL`, then opens the host app via the
 * custom URL scheme `buyorholding://share?url=...`.
 *
 * This module:
 *  1) Listens for `appUrlOpen` events from Capacitor's App plugin
 *     and forwards `?url=` to the in-app `/share` route.
 *  2) On every app resume / cold start, checks the App Group's
 *     UserDefaults via the custom `SharedDataPlugin` and routes if
 *     a pending URL is found.
 *
 * No-op on the web build (Capacitor.isNativePlatform() === false).
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";

interface SharedDataPlugin {
  consumeSharedUrl(): Promise<{ url: string | null }>;
}

const SharedData = registerPlugin<SharedDataPlugin>("SharedData");

function navigateToShare(rawUrl: string) {
  if (!rawUrl) return;
  // Already encoded URL coming from the extension
  const target = `/share?url=${encodeURIComponent(rawUrl)}`;
  // Use replace so the share handler isn't kept in history
  window.location.replace(target);
}

export function initNativeShareBridge() {
  if (!Capacitor.isNativePlatform()) return;

  // Cold-start / resume: pull anything the extension stashed
  const drain = async () => {
    try {
      const { url } = await SharedData.consumeSharedUrl();
      if (url) navigateToShare(url);
    } catch {
      /* plugin may not be installed yet on first run */
    }
  };

  drain();
  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) drain();
  });

  // Custom URL scheme fallback: buyorholding://share?url=...
  App.addListener("appUrlOpen", ({ url }) => {
    try {
      const parsed = new URL(url);
      const shared = parsed.searchParams.get("url");
      if (shared) navigateToShare(shared);
    } catch {
      /* ignore malformed */
    }
  });
}
