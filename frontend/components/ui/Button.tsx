import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tom = "sol" | "claro" | "nu" | "alerta";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tom?: Tom;
  /** Ocupa a largura toda. Usado na ação principal do rodapé de cada tela. */
  largo?: boolean;
  children: ReactNode;
};

const TOM: Record<Tom, string> = {
  sol: "tv-btn--sol",
  claro: "tv-btn--claro",
  nu: "tv-btn--nu",
  alerta: "tv-btn--alerta",
};

export function Button({
  tom = "claro",
  largo = false,
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`tv-btn ${TOM[tom]} ${largo ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
