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
    entries.push(["Destino", preferences.destination]);
  }
  if (preferences.country) {
    entries.push(["País", preferences.country]);
  }
  if (preferences.category) {
    entries.push(["Tipo", preferences.category]);
  }
  if (preferences.month) {
    const label = preferences.season
      ? `${preferences.month} (${preferences.season})`
      : preferences.month;
    entries.push(["Mês", label]);
  }
  if (preferences.travelers) {
    entries.push(["Viajantes", String(preferences.travelers)]);
  }
  if (preferences.budget_level) {
    entries.push(["Orçamento", preferences.budget_level]);
  }
  if (preferences.max_budget) {
    entries.push(["Até", currency.format(preferences.max_budget)]);
  }

  return (
    <section className="rounded-2xl bg-sand p-5">
      <h2 className="font-display text-xl font-extrabold">O que entendemos</h2>
      {entries.length === 0 ? (
        <p className="mt-3 text-xl text-muted">
          Não deu para pegar um pedido específico — mostrando as opções mais em
          conta.
        </p>
      ) : (
        <dl className="mt-3 flex flex-wrap gap-2">
          {entries.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-panel px-3 py-2">
              <dt className="text-lg text-muted">{label}</dt>
              <dd className="text-xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
