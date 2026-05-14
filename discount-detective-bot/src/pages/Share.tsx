import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAddProduct } from "@/hooks/useProducts";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Extract the first http(s) URL from a string (handles cases where apps share
// "Title - https://..." in the `text` param instead of `url`).
function extractUrl(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (!c) continue;
    const trimmed = c.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const match = trimmed.match(/https?:\/\/[^\s]+/i);
    if (match) return match[0];
  }
  return null;
}

const Share = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const add = useAddProduct();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("공유된 상품을 등록 중입니다...");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const url = extractUrl(params.get("url"), params.get("text"), params.get("title"));

    if (!url) {
      setStatus("error");
      setMessage("공유된 데이터에서 상품 URL을 찾을 수 없습니다.");
      return;
    }

    (async () => {
      try {
        await add.mutateAsync(url);
        setStatus("success");
        setMessage("상품이 등록되었습니다 🎉");
        toast({ title: "상품이 등록되었습니다 🎉" });
        setTimeout(() => navigate("/", { replace: true }), 1200);
      } catch (err: any) {
        setStatus("error");
        setMessage(err?.message ?? "등록에 실패했습니다.");
        toast({ title: "등록 실패", description: err?.message, variant: "destructive" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto text-primary" />
            <p className="text-sm font-medium">{message}</p>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
            <p className="text-sm font-medium">{message}</p>
            <Button onClick={() => navigate("/", { replace: true })} className="w-full">
              홈으로 돌아가기
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default Share;
