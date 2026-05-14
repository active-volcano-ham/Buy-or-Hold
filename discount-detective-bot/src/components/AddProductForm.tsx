import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddProduct } from "@/hooks/useProducts";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus } from "lucide-react";

export const AddProductForm = () => {
  const [url, setUrl] = useState("");
  const add = useAddProduct();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    try {
      await add.mutateAsync(url.trim());
      toast({ title: "상품이 등록되었습니다 🎉" });
    } catch (err: any) {
      toast({
        title: "등록 실패",
        description: err?.message || "URL을 확인하고 다시 시도해주세요",
        variant: "destructive",
      });
    } finally {
      setUrl("");
    }
  };

  return (
    <form onSubmit={submit} className="flex gap-2 w-full">
      <Input
        type="url"
        placeholder="쇼핑몰 상품 URL을 붙여넣으세요"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="flex-1 h-12 rounded-xl bg-card border-border"
        required
      />
      <Button type="submit" disabled={add.isPending} className="h-12 rounded-xl px-5">
        {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />등록</>}
      </Button>
    </form>
  );
};
