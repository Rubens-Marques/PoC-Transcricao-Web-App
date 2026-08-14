export function UserAvatar({ name }: { name?: string }) {
  /** Inicial em vez de ícone genérico: identifica de relance de quem é o balão
   *  sem depender do lado em que ele está. */
  const initial = (name ?? "").trim().charAt(0).toUpperCase();

  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-linha-forte bg-papel text-apoio text-suave"
    >
      {initial || "?"}
    </span>
  );
}
