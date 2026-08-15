"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* The Web Speech API is a draft spec that ships unprefixed in some browsers and
 * behind `webkit` in others. These structural types cover only what this PoC
 * touches, and are deliberately local so they cannot collide with whatever
 * lib.dom.d.ts declares in a future TypeScript release. */

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeLike | undefined;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike | undefined;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const candidate = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return (
    candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null
  );
}

/** Em pt-BR e dizendo o que fazer, não só o que falhou: o público do produto
 *  não vai traduzir "service-not-allowed" nem deduzir o próximo passo. */
const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed":
    "The microphone is blocked. Allow the microphone in the browser settings and tap Speak again.",
  "service-not-allowed":
    "The browser blocked speech recognition. You can write your request in the box above.",
  "no-speech":
    "I did not hear anything. Tap Speak and talk a little closer to the microphone.",
  "audio-capture":
    "I could not find a microphone on this device. You can write your request in the box above.",
  network:
    "I could not reach the speech service. Please try again in a moment.",
  aborted: "",
};

export interface UseSpeechRecognitionOptions {
  lang: string;
}

export interface UseSpeechRecognitionResult {
  /** null while the browser check has not run yet (server render / first paint). */
  isSupported: boolean | null;
  isListening: boolean;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
  setTranscript: (value: string) => void;
}

export function useSpeechRecognition({
  lang,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionResult {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  /** Text already marked final by the engine. Interim results are appended for
   *  display only, so a revised guess never duplicates settled text. */
  const finalTranscriptRef = useRef("");
  const langRef = useRef(lang);

  useEffect(() => {
    langRef.current = lang;
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang;
    }
  }, [lang]);

  useEffect(() => {
    setIsSupported(getRecognitionConstructor() !== null);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (isListening) {
      return;
    }

    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setIsSupported(false);
      setError(
        "This browser cannot hear speech. Write your request in the box above.",
      );
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = langRef.current;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const alternative = result?.[0];
        if (!result || !alternative) {
          continue;
        }
        if (result.isFinal) {
          finalTranscriptRef.current =
            `${finalTranscriptRef.current} ${alternative.transcript}`.trim();
        } else {
          interim += alternative.transcript;
        }
      }
      setTranscript(`${finalTranscriptRef.current} ${interim}`.trim());
    };

    recognition.onerror = (event) => {
      const message = ERROR_MESSAGES[event.error];
      setError(
        message ??
          "I could not hear that now. Try again or write your request.",
      );
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    finalTranscriptRef.current = transcript.trim();
    setError(null);
    setIsListening(true);
    recognition.start();
  }, [isListening, transcript]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    finalTranscriptRef.current = "";
    setTranscript("");
    setError(null);
    setIsListening(false);
  }, []);

  const setTranscriptManually = useCallback((value: string) => {
    finalTranscriptRef.current = value;
    setTranscript(value);
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    error,
    start,
    stop,
    reset,
    setTranscript: setTranscriptManually,
  };
}
