"use client";

import { useState } from "react";

import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

const LANGUAGES = [
  { code: "pt-BR", label: "Português" },
  { code: "en-US", label: "English" },
] as const;

type LanguageCode = (typeof LANGUAGES)[number]["code"];

const EXAMPLES: Record<LanguageCode, string> = {
  "pt-BR":
    "Quero viajar para uma praia em dezembro com minha esposa, orçamento de uns 5000 reais",
  "en-US":
    "I want to travel to a beach destination in December with my wife, budget around 5000 reais",
};

interface VoiceRecorderProps {
  onSearch: (text: string) => void;
  isSearching: boolean;
}

export function VoiceRecorder({ onSearch, isSearching }: VoiceRecorderProps) {
  const [lang, setLang] = useState<LanguageCode>("pt-BR");
  const {
    isSupported,
    isListening,
    transcript,
    error,
    start,
    stop,
    reset,
    setTranscript,
  } = useSpeechRecognition({ lang });

  const trimmed = transcript.trim();
  const canSearch = trimmed.length > 0 && !isSearching;

  return (
    <section className="rounded-2xl bg-sand p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[1.875rem] font-extrabold leading-tight">
            Conte a viagem
          </h2>
          <p className="mt-2 text-xl text-muted">
            Fale o destino, a época, com quem vai e quanto quer gastar.
          </p>
        </div>

        <div
          className="inline-flex gap-2"
          role="group"
          aria-label="Idioma da fala"
        >
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              type="button"
              onClick={() => setLang(language.code)}
              disabled={isListening}
              aria-pressed={lang === language.code}
              className={`btn min-h-16 px-4 text-lg ${
                lang === language.code ? "chip-on" : "btn-ghost"
              }`}
            >
              {lang === language.code ? "✓ " : ""}
              {language.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {isListening ? (
          <button type="button" onClick={stop} className="btn btn-warn px-5">
            Parar de ouvir
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={isSupported === false}
            className="btn btn-voice px-5"
          >
            Falar
          </button>
        )}

        <button
          type="button"
          onClick={reset}
          disabled={trimmed.length === 0 && !isListening}
          className="btn btn-ghost px-4"
        >
          Limpar
        </button>

        {isListening && (
          <span className="text-lg text-muted" role="status">
            Ouvindo…
          </span>
        )}
      </div>

      <div className="mt-8">
        <label htmlFor="transcription" className="block text-xl font-bold">
          O que você disse
        </label>
        <textarea
          id="transcription"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          rows={3}
          placeholder={EXAMPLES[lang]}
          className="field mt-3 min-h-24 resize-y py-4"
        />
        <p className="mt-3 text-lg text-muted">
          O navegador escreve o que você fala. Pode editar ou digitar direto.
        </p>
      </div>

      {isSupported === false && (
        <p className="btn-warn mt-6 rounded-2xl px-4 py-3 text-lg">
          Este navegador não entende fala. No Chrome e no Edge funciona — ou
          escreva o pedido acima.
        </p>
      )}

      {error && (
        <p className="btn-warn mt-6 rounded-2xl px-4 py-3 text-lg">{error}</p>
      )}

      <button
        type="button"
        onClick={() => onSearch(trimmed)}
        disabled={!canSearch}
        className="btn btn-primary mt-8 w-full"
      >
        {isSearching ? "Buscando…" : "Buscar"}
      </button>
    </section>
  );
}
