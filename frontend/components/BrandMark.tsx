type BrandMarkProps = {
  variant?: "horizontal" | "symbol";
  className?: string;
  alt?: string;
};

const SRC = {
  horizontal: "/brand/travely-logo-horizontal.svg",
  symbol: "/brand/travely-simbolo.svg",
} as const;

export function BrandMark({
  variant = "horizontal",
  className,
  alt = "Travely",
}: BrandMarkProps) {
  return (
    // Wordmark is already outlined in the SVG; img keeps clip-path IDs unique.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={SRC[variant]} alt={alt} className={className} />
  );
}
