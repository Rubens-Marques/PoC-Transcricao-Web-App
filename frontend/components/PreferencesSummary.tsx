import type { TravelPreferences } from "@/types/travel";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

interface PreferencesSummaryProps {
  preferences: TravelPreferences;
}

/** Shows what the LLM understood. In a PoC this is the point of the demo:
 *  it makes the extraction step visible instead of implied. */
export function PreferencesSummary({ preferences }: PreferencesSummaryProps) {
  const entries: Array<[string, string]> = [];

  if (preferences.destination) {
    entries.push(["Destination", preferences.destination]);
  }
  if (preferences.category) {
    entries.push(["Category", preferences.category]);
  }
  if (preferences.month) {
    entries.push(["Month", preferences.month]);
  }
  if (preferences.travelers) {
    entries.push(["Travelers", String(preferences.travelers)]);
  }
  if (preferences.budget_level) {
    entries.push(["Budget level", preferences.budget_level]);
  }
  if (preferences.max_budget) {
    entries.push(["Max budget", currency.format(preferences.max_budget)]);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        What we understood
      </h2>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No specific preference was detected — showing the most affordable
          options.
        </p>
      ) : (
        <dl className="mt-3 flex flex-wrap gap-2">
          {entries.map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5"
            >
              <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                {label}
              </dt>
              <dd className="text-sm font-medium text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
