type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string | null;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  placeholder?: string;
  /** Rótulo em corpo, não em título. Para campos agrupados (cidade/estado). */
  compacto?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
};

/** Rótulo sempre visível e acima do campo — placeholder não é rótulo: some
 *  ao digitar, e é exatamente aí que a pessoa precisa lembrar o que era. */
export function TextField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  type = "text",
  autoComplete,
  maxLength,
  placeholder,
  compacto = false,
  inputRef,
}: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-erro` : undefined;
  const described = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex w-full flex-col items-center text-center">
      <label
        htmlFor={id}
        className={
          compacto ? "text-corpo font-medium" : "font-display text-titulo"
        }
      >
        {label}
      </label>

      {hint && (
        <p id={hintId} className="mt-2 text-apoio text-suave">
          {hint}
        </p>
      )}

      <input
        ref={inputRef}
        id={id}
        className="tv-campo mt-4 min-w-0"
        type={type}
        value={value}
        autoComplete={autoComplete}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        onChange={(event) => onChange(event.target.value)}
      />

      {error && (
        <p id={errorId} className="mt-2 text-apoio text-alerta">
          {error}
        </p>
      )}
    </div>
  );
}
