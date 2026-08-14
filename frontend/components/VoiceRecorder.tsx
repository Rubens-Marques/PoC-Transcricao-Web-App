"use client";

import { useState } from "react";

import { IconClear, IconMic, IconSearch, IconStop } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { OptionList } from "@/components/ui/OptionList";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

const LANGUAGES = [
  { id: "pt-BR" as const, label: "Português" },
  { id: "en-US" as const, label: "English" },
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

  return (
    <section className="flex w-full flex-col items-center">
      {/* O botão de falar vem antes da caixa de texto: é o caminho principal,
       *  e quem não quiser falar encontra a caixa logo abaixo dele. */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {isListening ? (
          <Button tom="alerta" onClick={stop}>
            <IconStop className="h-5 w-5" />
            Parar de ouvir
          </Button>
        ) : (
          <Button tom="sol" onClick={start} disabled={isSupported === false}>
            <IconMic className="h-5 w-5" />
            Falar
          </Button>
        )}

        <Button
          tom="nu"
          onClick={reset}
          disabled={trimmed.length === 0 && !isListening}
        >
          <IconClear className="h-5 w-5" />
          Limpar
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
          Estou ouvindo…
        </p>
      )}

      <div className="mt-8 flex w-full flex-col items-center">
        <label htmlFor="transcription" className="text-corpo">
          O que você quer
        </label>
        <p className="mt-2 text-apoio text-suave">
          O que você falar aparece aqui. Dá para corrigir ou escrever direto.
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
        <p className="text-apoio text-suave">Idioma da fala</p>
        <div className="mt-3">
          <OptionList
            legend="Idioma da fala"
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
            Este navegador não entende fala. No Chrome e no Edge funciona — ou
            escreva o seu pedido na caixa acima.
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
          {isSearching ? "Procurando viagens…" : "Ver viagens para mim"}
        </Button>
      </div>
    </section>
  );
}
