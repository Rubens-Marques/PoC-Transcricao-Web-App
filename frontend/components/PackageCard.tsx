import type { Recommendation } from "@/types/travel";

const CATEGORY_LABELS: Record<string, string> = {
  beach: "🏖️ Beach",
  cold: "🏔️ Cold",
  city: "🏙️ City",
  adventure: "🧗 Adventure",
  culture: "🏛️ Culture",
  nature: "🌿 Nature",
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
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">{name}</h3>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          {CATEGORY_LABELS[category] ?? category}
        </span>
      </div>

      <p className="mt-1 text-sm text-slate-500">
        {destination} — {country}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        {description}
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-sm">
        <div>
          <dt className="text-xs text-slate-400">Duration</dt>
          <dd className="mt-0.5 font-medium text-slate-800">{days} days</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Up to</dt>
          <dd className="mt-0.5 font-medium text-slate-800">
            {maxPeople} people
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Price</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {currency.format(price)}
          </dd>
        </div>
      </dl>

      {matchReasons.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {matchReasons.map((reason) => (
            <li
              key={reason}
              className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
            >
              {reason}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
