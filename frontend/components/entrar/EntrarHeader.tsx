import { BrandMark } from "@/components/BrandMark";

export function EntrarHeader({
  onBack,
  note,
  progress,
}: {
  onBack: () => void;
  note: string;
  progress?: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          className="btn btn-ghost px-4 py-2 text-lg"
          onClick={onBack}
        >
          Voltar
        </button>
        <BrandMark variant="symbol" className="h-12 w-12" />
        <p className="min-w-0 text-right text-lg leading-tight text-muted">
          {note}
        </p>
      </div>
      {progress != null && (
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Progresso do cadastro"
        >
          <div
            className="progress-fill"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
