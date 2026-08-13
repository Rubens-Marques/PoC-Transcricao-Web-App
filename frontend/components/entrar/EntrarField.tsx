export function EntrarField({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  maxLength,
  compact = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  compact?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className={
          compact
            ? "block text-xl font-bold"
            : "block font-display text-[1.875rem] font-extrabold leading-tight"
        }
      >
        {label}
      </label>
      <input
        id={id}
        className={`field min-w-0 ${compact ? "mt-3" : "mt-6"}`}
        type={type}
        value={value}
        autoComplete={autoComplete}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
