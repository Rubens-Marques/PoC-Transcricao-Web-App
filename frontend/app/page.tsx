"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/BrandMark";
import { PreferencesSummary } from "@/components/PreferencesSummary";
import { ResultsList } from "@/components/ResultsList";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import {
  clearProfile,
  firstName,
  loadProfile,
  type TravelyProfile,
} from "@/lib/profile";
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
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loaded = loadProfile();
    if (!loaded) {
      router.replace("/entrar");
      return;
    }
    setProfile(loaded);
  }, [router]);

  /** Os resultados chegam abaixo da dobra. Sem mover o foco, quem usa teclado
   *  ou leitor de tela não fica sabendo que a resposta chegou. */
  useEffect(() => {
    if (result) resultsRef.current?.focus();
  }, [result]);

  async function handleSearch(text: string) {
    setIsSearching(true);
    setError(null);
    try {
      setResult(await fetchRecommendations(text));
    } catch (caught: unknown) {
      setResult(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Não consegui buscar agora. Tente de novo.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  if (profile === undefined || profile === null) {
    return (
      <main className="flex min-h-svh items-center justify-center px-5">
        <p className="text-corpo text-suave" role="status">
          Abrindo o Brio…
        </p>
      </main>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-papel">
      <header className="border-b border-linha">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-5 py-3">
          <span className="w-20" />
          <BrandMark className="h-8 w-auto" />
          <Button
            tom="nu"
            className="w-20 px-3 text-apoio"
            onClick={() => {
              clearProfile();
              router.push("/entrar");
            }}
          >
            Sair
          </Button>
        </div>
      </header>

      <main
        id="conteudo"
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-10 px-5 py-12 text-center"
      >
        <div>
          <h1>Olá, {firstName(profile.name)}.</h1>
          <p className="mt-4 text-corpo text-suave">
            Para onde você quer ir? Conte o lugar, a época, com quem vai e
            quanto quer gastar.
          </p>
        </div>

        <VoiceRecorder onSearch={handleSearch} isSearching={isSearching} />

        {error && (
          <div className="w-full">
            <Callout tom="erro">{error}</Callout>
          </div>
        )}

        {result && (
          <div
            ref={resultsRef}
            tabIndex={-1}
            className="flex w-full flex-col gap-10 outline-none"
          >
            <PreferencesSummary preferences={result.preferences} />
            <ResultsList recommendations={result.recommendations} />
          </div>
        )}
      </main>
    </div>
  );
}
