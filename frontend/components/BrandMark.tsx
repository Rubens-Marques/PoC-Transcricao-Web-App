type BrandMarkProps = {
  variant?: "horizontal" | "symbol";
  className?: string;
  alt?: string;
};

const SYMBOL = "/brand/travely-simbolo.svg";

export function BrandMark({
  variant = "horizontal",
  className,
  alt = "Brio",
}: BrandMarkProps) {
  if (variant === "symbol") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={SYMBOL} alt={alt} className={className} />
    );
  }

  return (
    <span className="inline-flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SYMBOL} alt="" className={className} />
      <span className="font-display text-titulo font-extrabold leading-none">
        {alt}
      </span>
    </span>
  );
}
