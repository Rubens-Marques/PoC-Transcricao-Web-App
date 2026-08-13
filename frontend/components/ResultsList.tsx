import { PackageCard } from "@/components/PackageCard";
import type { Recommendation } from "@/types/travel";

interface ResultsListProps {
  recommendations: Recommendation[];
}

export function ResultsList({ recommendations }: ResultsListProps) {
  if (recommendations.length === 0) {
    return (
      <section className="rounded-2xl bg-sand p-10 text-center">
        <p className="text-xl font-bold">Ainda não achei um pacote assim.</p>
        <p className="mt-2 text-xl text-muted">
          Tente outra época, outro tipo de viagem ou outro orçamento.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-display text-xl font-extrabold">
        {recommendations.length}{" "}
        {recommendations.length === 1 ? "sugestão" : "sugestões"}
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
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
