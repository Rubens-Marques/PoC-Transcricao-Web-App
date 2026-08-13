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
    <article className="flex flex-col rounded-2xl bg-sand p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-extrabold">{name}</h3>
        <span className="shrink-0 rounded-2xl bg-blue-soft px-3 py-1 text-lg font-bold text-ink">
          {CATEGORY_LABELS[category] ?? category}
        </span>
      </div>

      <p className="mt-2 text-lg text-muted">
        {destination} — {country}
      </p>

      <p className="mt-3 text-xl leading-relaxed">{description}</p>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-lg">
        <div>
          <dt className="text-muted">Duração</dt>
          <dd className="mt-0.5 font-bold">
            {days} {days === 1 ? "dia" : "dias"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Até</dt>
          <dd className="mt-0.5 font-bold">
            {maxPeople} {maxPeople === 1 ? "pessoa" : "pessoas"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Preço</dt>
          <dd className="mt-0.5 font-bold">{currency.format(price)}</dd>
        </div>
      </dl>

      {matchReasons.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {matchReasons.map((reason) => (
            <li
              key={reason}
              className="rounded-2xl bg-blue-soft px-3 py-1 text-lg font-bold"
            >
              {reason}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
