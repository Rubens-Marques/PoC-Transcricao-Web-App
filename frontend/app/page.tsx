"use client";

import { useState } from "react";

import { PreferencesSummary } from "@/components/PreferencesSummary";
import { ResultsList } from "@/components/ResultsList";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { fetchRecommendations } from "@/services/api";
import type { RecommendationResponse } from "@/types/travel";

export default function HomePage() {
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(text: string) {
    setIsSearching(true);
    setError(null);
    try {
      setResult(await fetchRecommendations(text));
    } catch (caught: unknown) {
      setResult(null);
      setError(
        caught instanceof Error ? caught.message : "Unexpected error occurred.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
          Proof of concept
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Say where you want to go
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Your voice is transcribed in the browser, an LLM turns the sentence
          into structured travel preferences, and the backend matches them
          against the package catalogue.
        </p>
      </header>

      <VoiceRecorder onSearch={handleSearch} isSearching={isSearching} />

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-6">
          <PreferencesSummary preferences={result.preferences} />
          <ResultsList recommendations={result.recommendations} />
        </div>
      )}
    </main>
  );
}
