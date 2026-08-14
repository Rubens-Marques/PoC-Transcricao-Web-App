import { PackageCard } from "@/components/PackageCard";
import type { Recommendation } from "@/types/travel";

interface ResultsListProps {
  recommendations: Recommendation[];
}

export function ResultsList({ recommendations }: ResultsListProps) {
  if (recommendations.length === 0) {
    return (
      <section className="tv-placa p-10 text-center">
        <h2>Ainda não achei uma viagem assim.</h2>
        {/* Vazio que diz o que fazer em seguida, não só que deu vazio. */}
        <p className="mt-3 text-corpo text-suave">
          Tente outra época do ano, outro tipo de viagem ou um valor diferente.
        </p>
      </section>
    );
  }

  return (
    <section className="text-center">
      <h2>
        {recommendations.length === 1
          ? "Achei 1 viagem para você"
          : `Achei ${recommendations.length} viagens para você`}
      </h2>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {recommendations.map((recommendation) => (
          <PackageCard
            key={recommendation.id}
            recommendation={recommendation}
          />
        ))}
      </div>
    </section>
  );
}
