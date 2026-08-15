import { PackageCard } from "@/components/PackageCard";
import type { Recommendation } from "@/types/travel";

interface ResultsListProps {
  recommendations: Recommendation[];
}

export function ResultsList({ recommendations }: ResultsListProps) {
  if (recommendations.length === 0) {
    return (
      <section className="tv-placa p-10 text-center">
        <h2>I have not found a trip like that yet.</h2>
        <p className="mt-3 text-corpo text-suave">
          Try another time of year, another kind of trip, or a different budget.
        </p>
      </section>
    );
  }

  return (
    <section className="text-center">
      <h2>
        {recommendations.length === 1
          ? "I found 1 trip for you"
          : `I found ${recommendations.length} trips for you`}
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
