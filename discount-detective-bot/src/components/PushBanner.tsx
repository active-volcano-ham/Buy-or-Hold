import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Share } from "lucide-react";
import { enablePushNotifications, getPushStatus, isIOS, isStandalone } from "@/lib/push";
import { toast } from "@/hooks/use-toast";

export const PushBanner = () => {
  const [status, setStatus] = useState<"granted" | "denied" | "default" | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);

  useEffect(() => {
    getPushStatus().then(setStatus);
    setNeedsInstall(isIOS() && !isStandalone());
  }, []);

  if (status === "granted") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bell className="h-3.5 w-3.5 text-primary" /> 알림 켜짐 · 매일 오전 7시 가격 체크
      </div>
    );
  }
  if (status === "unsupported") return null;

  // iOS not installed — show install instructions instead of an enable button
  if (needsInstall) {
    return (
      <div className="bg-accent/40 border border-border rounded-2xl p-4 flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Share className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">iPhone에서 알림 받기</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Safari 하단 공유 버튼 <Share className="inline h-3 w-3 mx-0.5" /> →
            <span className="font-medium"> '홈 화면에 추가'</span> 후, 홈 화면의 아이콘으로 앱을 다시 열어 주세요.
          </p>
        </div>
      </div>
    );
  }

  const enable = async () => {
    setBusy(true);
    try {
      const r = await enablePushNotifications();
      if (r.ok) {
        setStatus("granted");
        toast({ title: "알림이 켜졌습니다 🔔", description: "매일 오전 7시에 가격을 확인해 알려 드릴게요." });
      } else {
        toast({ title: "알림 켜기 실패", description: r.reason, variant: "destructive" });
        const s = await getPushStatus();
        setStatus(s);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-accent/40 border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          {status === "denied" ? <BellOff className="h-4 w-4 text-primary" /> : <Bell className="h-4 w-4 text-primary" />}
        </div>
        <div>
          <p className="text-sm font-medium">목표가 알림 받기</p>
          <p className="text-xs text-muted-foreground">
            {status === "denied"
              ? "브라우저 설정에서 알림을 허용해 주세요."
              : "버튼을 누르면 알림 권한을 요청합니다. 매일 오전 7시 자동 체크."}
          </p>
        </div>
      </div>
      {status !== "denied" && (
        <Button size="sm" onClick={enable} disabled={busy} className="rounded-xl">
          {busy ? "..." : "켜기"}
        </Button>
      )}
    </div>
  );
};
