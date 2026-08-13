import { BrandMark } from "@/components/BrandMark";

export function BotAvatar() {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1">
      <BrandMark variant="symbol" alt="" className="h-12 w-12" />
      <span className="text-center text-lg font-bold leading-tight">
        Travely
      </span>
    </div>
  );
}
