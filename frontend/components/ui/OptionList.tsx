import { Check } from "@/components/ui/Check";

type Option<T extends string> = {
  id: T;
  label: string;
  hint?: string;
};

type OptionListProps<T extends string> = {
  /** Rótulo do grupo. Vira o nome acessível da lista de rádios. */
  legend: string;
  options: readonly Option<T>[];
  value: T | null;
  onChange: (id: T) => void;
  /** Distribui em duas colunas a partir de `sm`. Para listas de 4+ itens. */
  colunas?: boolean;
};

/** Escolha única em cartões grandes. `role="radiogroup"` em vez de `<select>`:
 *  o menu nativo de select abre uma lista pequena e rolável, que é o pior
 *  alvo possível para quem tem tremor ou visão reduzida. */
export function OptionList<T extends string>({
  legend,
  options,
  value,
  onChange,
  colunas = false,
}: OptionListProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={legend}
      className={`grid gap-3 ${colunas ? "sm:grid-cols-2" : ""}`}
    >
      {options.map((option) => {
        const on = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={on}
            className={`tv-opcao ${on ? "tv-opcao--on" : ""}`}
            onClick={() => onChange(option.id)}
          >
            <Check on={on} />
            <span className="flex min-w-0 flex-col">
              <span>{option.label}</span>
              {option.hint && (
                <span className="text-apoio text-suave">{option.hint}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type MultiListProps = {
  legend: string;
  options: readonly string[];
  selected: readonly string[];
  onToggle: (item: string) => void;
};

/** Escolha múltipla. Mesma anatomia visual da única, mas com `checkbox`:
 *  a diferença entre "escolha um" e "escolha vários" precisa chegar ao
 *  leitor de tela, não só ao olho. */
export function MultiList({
  legend,
  options,
  selected,
  onToggle,
}: MultiListProps) {
  return (
    <div role="group" aria-label={legend} className="grid gap-3 sm:grid-cols-2">
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            role="checkbox"
            aria-checked={on}
            className={`tv-opcao ${on ? "tv-opcao--on" : ""}`}
            onClick={() => onToggle(option)}
          >
            <Check on={on} />
            <span>{option}</span>
          </button>
        );
      })}
    </div>
  );
}
