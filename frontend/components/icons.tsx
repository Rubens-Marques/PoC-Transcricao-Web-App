import type { ReactNode } from "react";

type IconProps = {
  className?: string;
};

/** Traço de 2,5 em ícones de 28px. Ícone de traço fino desaparece antes do
 *  texto quando a visão cai — aqui o peso do ícone acompanha o do rótulo. */
function Svg({
  className = "h-7 w-7",
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconSteps({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="6" cy="6.5" r="2.5" fill="currentColor" stroke="none" />
      <path d="M11 6.5h9" />
      <circle cx="6" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <path d="M11 12h9" />
      <circle cx="6" cy="17.5" r="2.5" fill="currentColor" stroke="none" />
      <path d="M11 17.5h9" />
    </Svg>
  );
}

export function IconChat({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-8l-4.5 3.5V16H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    </Svg>
  );
}

export function IconMic({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="9" y="3" width="6" height="10.5" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3" />
      <path d="M8.5 21h7" />
    </Svg>
  );
}

export function IconStop({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
    </Svg>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 5" />
    </Svg>
  );
}

export function IconClear({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6.5 6.5 17.5 17.5" />
      <path d="M17.5 6.5 6.5 17.5" />
    </Svg>
  );
}

export function IconSend({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </Svg>
  );
}

export function IconBack({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M20 12H5" />
      <path d="m11 6-6 6 6 6" />
    </Svg>
  );
}

export function IconPin({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}
