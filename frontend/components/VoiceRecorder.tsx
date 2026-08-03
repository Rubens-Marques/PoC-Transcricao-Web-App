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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Tell us about your trip
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Speak naturally — destination, season, who is coming, how much you
            want to spend.
          </p>
        </div>

        <div
          className="inline-flex rounded-lg border border-slate-200 p-0.5"
          role="group"
          aria-label="Speech recognition language"
        >
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              type="button"
              onClick={() => setLang(language.code)}
              disabled={isListening}
              aria-pressed={lang === language.code}
              className={`rounded-md px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                lang === language.code
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {language.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {isListening ? (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
          >
            <span
              className="size-2.5 animate-pulse rounded-full bg-white"
              aria-hidden="true"
            />
            Stop listening
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={isSupported === false}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span aria-hidden="true">🎙️</span>
            Start speaking
          </button>
        )}

        <button
          type="button"
          onClick={reset}
          disabled={trimmed.length === 0 && !isListening}
          className="rounded-xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear
        </button>

        {isListening && (
          <span className="text-sm text-slate-500" role="status">
            Listening…
          </span>
        )}
      </div>

      <div className="mt-6">
        <label
          htmlFor="transcription"
          className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Transcription
        </label>
        <textarea
          id="transcription"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          rows={3}
          placeholder={EXAMPLES[lang]}
          className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
        />
        <p className="mt-2 text-xs text-slate-400">
          The browser handles transcription. You can also edit or type the text
          directly.
        </p>
      </div>

      {isSupported === false && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This browser does not support the Web Speech API. Chrome and Edge do —
          meanwhile, type your request above.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => onSearch(trimmed)}
        disabled={!canSearch}
        className="mt-6 w-full rounded-xl bg-sky-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSearching ? "Searching…" : "Search travel options"}
      </button>
    </section>
  );
}
