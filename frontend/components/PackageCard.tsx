import type { Recommendation } from "@/types/travel";

const CATEGORY_LABELS: Record<string, string> = {
  beach: "Praia",
  cold: "Frio",
  city: "Cidade",
  adventure: "Aventura",
  culture: "Cultura",
  nature: "Natureza",
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

interface PackageCardProps {
  recommendation: Recommendation;
}

export function PackageCard({ recommendation }: PackageCardProps) {
  const {
    name,
    destination,
    country,
    category,
    description,
    days,
    price,
    max_people: maxPeople,
    match_reasons: matchReasons,
  } = recommendation;

  return (
    <article className="tv-placa flex flex-col items-center p-6 text-center">
      <span className="rounded-full border border-sol-200 bg-sol-100 px-3 py-1 text-apoio">
        {CATEGORY_LABELS[category] ?? category}
      </span>

      <h3 className="mt-4 font-display text-titulo">{name}</h3>

      <p className="mt-1 text-apoio text-suave">
        {destination} — {country}
      </p>

      <p className="mt-4 text-corpo">{description}</p>

      {/* Preço em destaque próprio: é o dado que decide a leitura do cartão. */}
      <p className="mt-6 font-display text-titulo">{currency.format(price)}</p>

      <dl className="mt-5 grid w-full grid-cols-2 gap-4 border-t border-linha pt-5 text-apoio">
        <div>
          <dt className="text-suave">Duração</dt>
          <dd className="mt-1 text-corpo">
            {days} {days === 1 ? "dia" : "dias"}
          </dd>
        </div>
        <div>
          <dt className="text-suave">Cabem até</dt>
          <dd className="mt-1 text-corpo">
            {maxPeople} {maxPeople === 1 ? "pessoa" : "pessoas"}
          </dd>
        </div>
      </dl>

      {matchReasons.length > 0 && (
        <div className="mt-6 w-full">
          <h4 className="text-apoio text-suave">Por que combina com você</h4>
          <ul className="mt-3 flex flex-col items-center gap-2">
            {matchReasons.map((reason) => (
              <li key={reason} className="flex items-center gap-2 text-apoio">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 text-sol-700"
                  aria-hidden
                >
                  <path
                    d="m5 12.5 4.5 4.5L19 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
