import { PackageCard } from "@/components/PackageCard";
import type { Recommendation } from "@/types/travel";

interface ResultsListProps {
  recommendations: Recommendation[];
}

export function ResultsList({ recommendations }: ResultsListProps) {
  if (recommendations.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">
          No package matches that request yet.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Try a different season, category, or budget.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {recommendations.length} recommendation
        {recommendations.length === 1 ? "" : "s"}
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
