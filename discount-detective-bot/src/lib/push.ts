import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "./device";

// Hardcoded VAPID public key (safe to expose). Mirror of VAPID_PUBLIC_KEY secret.
const VAPID_PUBLIC_KEY =
  "BKBSa1UQpsfeV1G_yxmfXZWhbCbNjebnJz4JD86Q7Wrmuq18P3SISVl9QWpNFx4DWoodOtWc3zyH-Ef6xyWVwls";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari uses navigator.standalone; others use display-mode media query
  // @ts-ignore - non-standard iOS property
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

async function registerSW(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return reg;
}

/**
 * MUST be called synchronously from a user gesture (tap handler) on iOS.
 * The first thing it does is call Notification.requestPermission() — do NOT
 * await anything before calling this function from the click handler.
 */
export async function enablePushNotifications(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) {
    return { ok: false, reason: "이 브라우저는 푸시 알림을 지원하지 않습니다." };
  }

  // iOS requires the app to be installed to the Home Screen (standalone mode)
  if (isIOS() && !isStandalone()) {
    return {
      ok: false,
      reason: "iPhone에서는 먼저 Safari 공유 메뉴 → '홈 화면에 추가'를 한 뒤, 홈 화면 아이콘으로 앱을 열어 주세요.",
    };
  }

  // Request permission FIRST, synchronously inside the user gesture
  let perm: NotificationPermission;
  try {
    perm = await Notification.requestPermission();
  } catch {
    return { ok: false, reason: "알림 권한 요청에 실패했습니다." };
  }
  if (perm !== "granted") {
    return { ok: false, reason: "알림 권한이 거부되었습니다." };
  }

  try {
    const reg = await registerSW();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const { error } = await supabase.functions.invoke("subscribe-push", {
      body: {
        device_id: getDeviceId(),
        subscription: sub.toJSON(),
        user_agent: navigator.userAgent,
      },
    });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "구독 등록 중 오류가 발생했습니다." };
  }
}

export async function getPushStatus(): Promise<"granted" | "denied" | "default" | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}
