import type { ReactNode } from "react";

type CalloutProps = {
  tom: "erro" | "aviso";
  children: ReactNode;
};

/** Recado de erro ou aviso. Nunca só cor: leva ícone com forma própria
 *  (triângulo para erro, círculo para aviso) mais o texto do que houve.
 *  Erro entra como `role="alert"` para ser anunciado na hora. */
export function Callout({ tom, children }: CalloutProps) {
  const erro = tom === "erro";

  return (
    <div
      role={erro ? "alert" : "status"}
      className={`flex items-center justify-center gap-3 rounded-tv border px-4 py-3 text-apoio ${
        erro
          ? "border-alerta/30 bg-alerta-fundo text-alerta"
          : "border-sol-200 bg-sol-100 text-tinta"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden>
        {erro ? (
          <path
            d="M12 3.5 21.5 20H2.5L12 3.5Zm0 6v4.5m0 3v.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            />
            <path
              d="M12 7.5v5.5m0 3v.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
      <p className="min-w-0">{children}</p>
    </div>
  );
}
