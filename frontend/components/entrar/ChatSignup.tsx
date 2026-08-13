"use client";

import { useEffect, useRef, useState } from "react";

import { BotAvatar } from "@/components/entrar/BotAvatar";
import { EntrarHeader } from "@/components/entrar/EntrarHeader";
import { UserAvatar } from "@/components/entrar/UserAvatar";
import { LIMITS, type TravelyProfile } from "@/lib/profile";
import { applyChatAnswer, CHAT_ORDER, CHAT_PROMPTS } from "@/lib/signup-chat";

type ChatTurn = { from: "bot" | "you"; text: string };

export function ChatSignup({
  profile,
  onProfile,
  onFinish,
  onBack,
}: {
  profile: TravelyProfile;
  onProfile: (next: TravelyProfile) => void;
  onFinish: (next: TravelyProfile) => void;
  onBack: () => void;
}) {
  const [fieldIndex, setFieldIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<ChatTurn[]>([
    { from: "bot", text: CHAT_PROMPTS.name },
  ]);
  const endRef = useRef<HTMLLIElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const finishTimer = useRef<number | null>(null);

  const field = CHAT_ORDER[fieldIndex];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [log]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [fieldIndex]);

  useEffect(() => {
    return () => {
      if (finishTimer.current != null) {
        window.clearTimeout(finishTimer.current);
      }
    };
  }, []);

  function send() {
    const text = draft.trim();
    if (!text || !field || busy) return;

    const applied = applyChatAnswer(field, text, profile);
    if (!applied.ok) {
      setLog((current) => [
        ...current,
        { from: "you", text },
        { from: "bot", text: applied.message },
      ]);
      setDraft("");
      return;
    }

    const nextProfile = applied.profile;
    onProfile(nextProfile);
    setDraft("");

    if (fieldIndex === CHAT_ORDER.length - 1) {
      setBusy(true);
      setLog((current) => [
        ...current,
        { from: "you", text },
        {
          from: "bot",
          text: `Pronto, ${nextProfile.name}. Vou abrir a busca por voz.`,
        },
      ]);
      finishTimer.current = window.setTimeout(() => onFinish(nextProfile), 700);
      return;
    }

    const nextField = CHAT_ORDER[fieldIndex + 1];
    if (!nextField) return;
    setFieldIndex((index) => index + 1);
    setLog((current) => [
      ...current,
      { from: "you", text },
      { from: "bot", text: CHAT_PROMPTS[nextField] },
    ]);
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-5 py-8">
      <EntrarHeader onBack={onBack} note="Conversar" />
      <ol
        className="mt-8 flex flex-1 flex-col gap-5"
        aria-live="polite"
        aria-relevant="additions"
      >
        {log.map((turn, index) => {
          const fromYou = turn.from === "you";
          return (
            <li
              key={`${turn.from}-${index}`}
              ref={index === log.length - 1 ? endRef : undefined}
              className={`flex min-w-0 items-end gap-3 ${fromYou ? "flex-row-reverse" : ""}`}
            >
              {fromYou ? <UserAvatar name={profile.name} /> : <BotAvatar />}
              <p
                className={
                  fromYou
                    ? "min-w-0 max-w-[40ch] break-words rounded-2xl rounded-br-md bg-sun-soft px-4 py-3 text-left text-xl font-normal"
                    : "min-w-0 max-w-[40ch] break-words rounded-2xl rounded-bl-md bg-sand px-4 py-3 text-left text-xl font-normal"
                }
              >
                <span className="sr-only">
                  {fromYou ? "Você: " : "Travely: "}
                </span>
                {turn.text}
              </p>
            </li>
          );
        })}
      </ol>
      <form
        className="sticky bottom-0 mt-8 flex min-w-0 items-end gap-3 bg-panel py-4"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <label className="sr-only" htmlFor="chat-draft">
          Sua resposta
        </label>
        <input
          ref={inputRef}
          id="chat-draft"
          className="field min-w-0 flex-1"
          value={draft}
          maxLength={LIMITS.chat}
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn btn-primary min-h-16 shrink-0 px-5 text-xl"
          disabled={busy}
        >
          Enviar
        </button>
      </form>
    </main>
  );
}
