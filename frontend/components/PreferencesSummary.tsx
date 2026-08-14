import type { TravelPreferences } from "@/types/travel";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

/** O backend devolve os enums em inglês (`beach`, `December`, `low`). Mostrar
 *  isso cru na tela obrigaria a pessoa a traduzir mentalmente o próprio pedido. */
const CATEGORIES: Record<string, string> = {
  beach: "Praia",
  cold: "Frio",
  city: "Cidade",
  adventure: "Aventura",
  culture: "Cultura",
  nature: "Natureza",
};

const MONTHS: Record<string, string> = {
  January: "janeiro",
  February: "fevereiro",
  March: "março",
  April: "abril",
  May: "maio",
  June: "junho",
  July: "julho",
  August: "agosto",
  September: "setembro",
  October: "outubro",
  November: "novembro",
  December: "dezembro",
};

const BUDGETS: Record<string, string> = {
  low: "Mais em conta",
  medium: "Intermediário",
  high: "Mais alto",
};

interface PreferencesSummaryProps {
  preferences: TravelPreferences;
}

/** Mostra o que o sistema entendeu do pedido antes dos resultados. Numa PoC
 *  isso é a demonstração em si — e para o usuário é a chance de perceber um
 *  mal-entendido sem precisar deduzi-lo pelas sugestões erradas. */
export function PreferencesSummary({ preferences }: PreferencesSummaryProps) {
  const entries: Array<[string, string]> = [];

  if (preferences.destination)
    entries.push(["Destino", preferences.destination]);
  if (preferences.country) entries.push(["País", preferences.country]);
  if (preferences.category) {
    entries.push([
      "Tipo de viagem",
      CATEGORIES[preferences.category] ?? preferences.category,
    ]);
  }
  if (preferences.month) {
    entries.push(["Quando", MONTHS[preferences.month] ?? preferences.month]);
  }
  if (preferences.travelers) {
    entries.push([
      "Quantas pessoas",
      preferences.travelers === 1
        ? "1 pessoa"
        : `${preferences.travelers} pessoas`,
    ]);
  }
  if (preferences.budget_level) {
    entries.push([
      "Orçamento",
      BUDGETS[preferences.budget_level] ?? preferences.budget_level,
    ]);
  }
  if (preferences.max_budget) {
    entries.push(["Até", currency.format(preferences.max_budget)]);
  }

  return (
    <section className="tv-placa tv-placa--areia p-6 text-center">
      <h2>O que eu entendi</h2>

      {entries.length === 0 ? (
        <p className="mt-3 text-corpo text-suave">
          Não consegui identificar um pedido específico — estou mostrando as
          opções mais em conta.
        </p>
      ) : (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {entries.map(([label, value]) => (
            <div key={label} className="rounded-tv border border-linha bg-papel px-4 py-3">
              <dt className="text-apoio text-suave">{label}</dt>
              <dd className="mt-1 text-corpo">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
