import type { TravelPreferences } from "@/types/travel";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const CATEGORIES: Record<string, string> = {
  beach: "Beach",
  cold: "Cold",
  city: "City",
  adventure: "Adventure",
  culture: "Culture",
  nature: "Nature",
};

const MONTHS: Record<string, string> = {
  January: "January",
  February: "February",
  March: "March",
  April: "April",
  May: "May",
  June: "June",
  July: "July",
  August: "August",
  September: "September",
  October: "October",
  November: "November",
  December: "December",
};

const BUDGETS: Record<string, string> = {
  low: "Lower cost",
  medium: "Mid-range",
  high: "Higher",
};

interface PreferencesSummaryProps {
  preferences: TravelPreferences;
}

export function PreferencesSummary({ preferences }: PreferencesSummaryProps) {
  const entries: Array<[string, string]> = [];

  if (preferences.destination)
    entries.push(["Destination", preferences.destination]);
  if (preferences.country) entries.push(["Country", preferences.country]);
  if (preferences.category) {
    entries.push([
      "Kind of trip",
      CATEGORIES[preferences.category] ?? preferences.category,
    ]);
  }
  if (preferences.month) {
    entries.push(["When", MONTHS[preferences.month] ?? preferences.month]);
  }
  if (preferences.travelers) {
    entries.push([
      "How many people",
      preferences.travelers === 1
        ? "1 person"
        : `${preferences.travelers} people`,
    ]);
  }
  if (preferences.budget_level) {
    entries.push([
      "Budget",
      BUDGETS[preferences.budget_level] ?? preferences.budget_level,
    ]);
  }
  if (preferences.max_budget) {
    entries.push(["Up to", currency.format(preferences.max_budget)]);
  }

  return (
    <section className="tv-placa tv-placa--areia p-6 text-center">
      <h2>What I understood</h2>

      {entries.length === 0 ? (
        <p className="mt-3 text-corpo text-suave">
          I could not pick out a specific request — I am showing the lower-cost
          options.
        </p>
      ) : (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {entries.map(([label, value]) => (
            <div
              key={label}
              className="rounded-tv border border-linha bg-papel px-4 py-3"
            >
              <dt className="text-apoio text-suave">{label}</dt>
              <dd className="mt-1 text-corpo">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
