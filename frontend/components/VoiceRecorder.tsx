"use client";

import { useState } from "react";

import { IconClear, IconMic, IconSearch, IconStop } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { OptionList } from "@/components/ui/OptionList";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

const LANGUAGES = [
  { id: "en-US" as const, label: "English" },
  { id: "pt-BR" as const, label: "Portuguese" },
];

type LanguageCode = (typeof LANGUAGES)[number]["id"];

const EXAMPLES: Record<LanguageCode, string> = {
  "pt-BR":
    "Quero uma praia em dezembro com a minha esposa, até uns cinco mil reais",
  "en-US": "A beach trip in December with my wife, up to five thousand reais",
};

interface VoiceRecorderProps {
  onSearch: (text: string) => void;
  isSearching: boolean;
}

export function VoiceRecorder({ onSearch, isSearching }: VoiceRecorderProps) {
  const [lang, setLang] = useState<LanguageCode>("en-US");
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

  return (
    <section className="flex w-full flex-col items-center">
      {/* O botão de falar vem antes da caixa de texto: é o caminho principal,
       *  e quem não quiser falar encontra a caixa logo abaixo dele. */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {isListening ? (
          <Button tom="alerta" onClick={stop}>
            <IconStop className="h-5 w-5" />
            Stop listening
          </Button>
        ) : (
          <Button tom="sol" onClick={start} disabled={isSupported === false}>
            <IconMic className="h-5 w-5" />
            Speak
          </Button>
        )}

        <Button
          tom="nu"
          onClick={reset}
          disabled={trimmed.length === 0 && !isListening}
        >
          <IconClear className="h-5 w-5" />
          Clear
        </Button>
      </div>

      {isListening && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 text-apoio text-suave"
        >
          <span
            aria-hidden
            className="h-2.5 w-2.5 animate-pulse rounded-full bg-alerta"
          />
          Listening…
        </p>
      )}

      <div className="mt-8 flex w-full flex-col items-center">
        <label htmlFor="transcription" className="text-corpo">
          What you want
        </label>
        <p className="mt-2 text-apoio text-suave">
          What you say appears here. You can edit it or type it yourself.
        </p>
        <textarea
          id="transcription"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          rows={3}
          placeholder={EXAMPLES[lang]}
          className="tv-campo mt-4 resize-y py-4"
          maxLength={1000}
        />
      </div>

      <div className="mt-8 w-full">
        <p className="text-apoio text-suave">Speech language</p>
        <div className="mt-3">
          <OptionList
            legend="Speech language"
            options={LANGUAGES}
            value={lang}
            onChange={setLang}
            colunas
          />
        </div>
      </div>

      {isSupported === false && (
        <div className="mt-6 w-full">
          <Callout tom="aviso">
            This browser cannot hear speech. Chrome and Edge work — or write
            your request in the box above.
          </Callout>
        </div>
      )}

      {error && (
        <div className="mt-6 w-full">
          <Callout tom="erro">{error}</Callout>
        </div>
      )}

      <div className="mt-8 w-full">
        <Button
          tom="sol"
          largo
          onClick={() => onSearch(trimmed)}
          disabled={trimmed.length === 0 || isSearching}
        >
          <IconSearch className="h-5 w-5" />
          {isSearching ? "Looking for trips…" : "Show trips for me"}
        </Button>
      </div>
    </section>
  );
}
