/** Marca de seleção. Existe para que "selecionado" não dependa só de cor —
 *  a caixa ganha o traço, o que sobrevive a daltonismo, tela lavada pelo sol
 *  e modo de alto contraste. */
export function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
        on ? "border-sol-700 bg-sol-700 text-papel" : "border-linha-forte"
      }`}
    >
      {on && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path
            d="m5 12.5 4.5 4.5L19 7"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}
