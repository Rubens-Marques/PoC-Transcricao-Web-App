import { Button } from "@/components/ui/Button";

type CounterProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

/** Contador de dois botões grandes. Substitui `<input type="number">`, cujas
 *  setinhas nativas têm ~10px de alvo e exigem precisão de mouse. */
export function Counter({ label, value, min, max, onChange }: CounterProps) {
  const id = `contador-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="flex flex-col items-center">
      <p id={id} className="text-corpo">
        {label}
      </p>
      <div className="mt-3 flex items-center gap-5">
        <Button
          className="h-14 w-14 shrink-0 px-0 text-3xl"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          −
        </Button>
        <output
          aria-labelledby={id}
          aria-live="polite"
          className="min-w-12 text-center font-display text-titulo-g"
        >
          {value}
        </output>
        <Button
          className="h-14 w-14 shrink-0 px-0 text-3xl"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          +
        </Button>
      </div>
    </div>
  );
}
