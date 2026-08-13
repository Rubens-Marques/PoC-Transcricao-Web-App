"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BrandMark } from "@/components/BrandMark";
import { PreferencesSummary } from "@/components/PreferencesSummary";
import { ResultsList } from "@/components/ResultsList";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { clearProfile, loadProfile, type TravelyProfile } from "@/lib/profile";
import { fetchRecommendations } from "@/services/api";
import type { RecommendationResponse } from "@/types/travel";

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<TravelyProfile | null | undefined>(
    undefined,
  );
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadProfile();
    if (!loaded) {
      router.replace("/entrar");
      return;
    }
    setProfile(loaded);
  }, [router]);

  async function handleSearch(text: string) {
    setIsSearching(true);
    setError(null);
    try {
      setResult(await fetchRecommendations(text));
    } catch (caught: unknown) {
      setResult(null);
      setError(
        caught instanceof Error ? caught.message : "Não consegui buscar agora.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  if (profile === undefined || profile === null) {
    return (
      <main className="flex min-h-svh items-center justify-center px-5">
        <p className="text-xl">Abrindo o Travely…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandMark variant="symbol" className="h-12 w-12" />
          <p className="font-display text-xl font-extrabold">
            Olá, {profile.name.split(" ")[0]}.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost px-4 py-2 text-base"
          onClick={() => {
            clearProfile();
            router.push("/entrar");
          }}
        >
          Sair
        </button>
      </div>
      <header>
        <h1 className="font-display text-[1.875rem] font-extrabold tracking-tight">
          Diga para onde você quer ir
        </h1>
        <p className="mt-3 max-w-2xl text-xl">
          Fale ou escreva a viagem. A gente entende e mostra pacotes que
          combinam.
        </p>
      </header>

      <VoiceRecorder onSearch={handleSearch} isSearching={isSearching} />

      {error && (
        <p role="alert" className="btn-warn rounded-2xl px-4 py-3 text-lg">
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-6">
          <PreferencesSummary preferences={result.preferences} />
          <ResultsList recommendations={result.recommendations} />
        </div>
      )}

      <p className="text-base">
        <Link href="/entrar" className="underline">
          Refazer o cadastro
        </Link>
      </p>
    </main>
  );
}
