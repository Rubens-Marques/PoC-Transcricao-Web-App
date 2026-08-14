type ProgressBarProps = {
  atual: number;
  total: number;
};

/** Progresso com o número escrito por extenso acima da barra. A barra sozinha
 *  exige estimar uma proporção; "Pergunta 3 de 7" não exige nada. */
export function ProgressBar({ atual, total }: ProgressBarProps) {
  const pct = Math.round((atual / total) * 100);

  return (
    <div className="flex flex-col items-center">
      <p className="text-apoio text-suave">
        Pergunta {atual} de {total}
      </p>
      <div
        className="tv-trilho mt-3 w-full max-w-xs"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={atual}
        aria-valuetext={`Pergunta ${atual} de ${total}`}
      >
        <div className="tv-trilho__preenche" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
