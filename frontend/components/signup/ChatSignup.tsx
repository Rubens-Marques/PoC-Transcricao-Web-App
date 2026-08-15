"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { BotAvatar } from "@/components/signup/BotAvatar";
import { QuickAnswer } from "@/components/signup/QuickAnswer";
import { SignupReview } from "@/components/signup/SignupReview";
import { SignupShell } from "@/components/signup/SignupShell";
import { UserAvatar } from "@/components/signup/UserAvatar";
import { IconSend } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { LIMITS, type TravelyProfile } from "@/lib/profile";
import {
  applyChatAnswer,
  applyInterpretedAnswer,
  CHAT_ORDER,
  CHAT_PROMPTS,
  shouldCallSignupModel,
} from "@/lib/signup-chat";
import { interpretSignupAnswer, type SignupAnswer } from "@/services/api";

type ChatTurn = { id: string; from: "bot" | "you"; text: string };

/** Piso da pausa antes da resposta do assistente. A espera real agora é a do
 *  modelo; isto só evita que uma resposta instantânea (atalho, ou modelo
 *  quente) apareça no mesmo quadro do envio, o que lê como falha de render. */
const MIN_TYPING_MS = 400;

function TypingIndicator() {
  const reduce = useReducedMotion();

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-w-0 items-end gap-3"
    >
      <BotAvatar />
      <div className="tv-balao tv-balao--bot inline-flex items-center gap-1.5 py-4">
        <span className="sr-only">Brio is typing</span>
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="h-2 w-2 rounded-full bg-sol-700"
            animate={reduce ? { opacity: 0.7 } : { opacity: [0.35, 1, 0.35] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: index * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </motion.li>
  );
}

function MessageRow({ turn, name }: { turn: ChatTurn; name: string }) {
  const reduce = useReducedMotion();
  const fromYou = turn.from === "you";

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`flex min-w-0 items-end gap-3 ${
        fromYou ? "flex-row-reverse" : ""
      }`}
    >
      {fromYou ? <UserAvatar name={name} /> : <BotAvatar />}
      <p className={`tv-balao ${fromYou ? "tv-balao--voce" : "tv-balao--bot"}`}>
        {/* Qual lado falou não pode depender só de alinhamento e cor. */}
        <span className="sr-only">{fromYou ? "You: " : "Brio: "}</span>
        {turn.text}
      </p>
    </motion.li>
  );
}

type Applied =
  { ok: true; profile: TravelyProfile } | { ok: false; message: string };

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
  const reduce = useReducedMotion();
  const [fieldIndex, setFieldIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [review, setReview] = useState<TravelyProfile | null>(null);
  const [log, setLog] = useState<ChatTurn[]>([
    { id: "bot-0", from: "bot", text: CHAT_PROMPTS.name },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const field = CHAT_ORDER[fieldIndex];
  const locked = busy || typing;

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({
      top: node.scrollHeight,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [log, typing, review, reduce]);

  useEffect(() => {
    if (review || locked) return;
    inputRef.current?.focus();
  }, [fieldIndex, locked, review]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function push(from: "bot" | "you", text: string) {
    setLog((current) => [
      ...current,
      { id: `${from}-${Date.now()}-${current.length}`, from, text },
    ]);
  }

  /** Segue para a próxima pergunta, ou encerra o cadastro. */
  function advance(nextProfile: TravelyProfile) {
    onProfile(nextProfile);

    if (fieldIndex === CHAT_ORDER.length - 1) {
      profileRef.current = nextProfile;
      setReview(nextProfile);
      push("bot", "Please check that your details are correct.");
      return;
    }

    const nextField = CHAT_ORDER[fieldIndex + 1];
    if (!nextField) return;
    setFieldIndex((index) => index + 1);
    push("bot", CHAT_PROMPTS[nextField]);
  }

  function settle(applied: Applied) {
    if (applied.ok) {
      advance(applied.profile);
      return;
    }
    // Não entendeu: repergunta e o índice não avança.
    push("bot", applied.message);
  }

  /** Resposta escrita: tenta o parser local primeiro. Só chama o modelo
   *  quando a frase é ambígua (gíria, email ditado de um jeito novo). */
  async function send() {
    const text = draft.trim();
    if (!text || !field || locked) return;

    push("you", text);
    setDraft("");

    const local = applyChatAnswer(field, text, profileRef.current);
    if (!shouldCallSignupModel(field, local)) {
      settle(local);
      return;
    }

    setTyping(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const startedAt = Date.now();
    let applied: Applied;

    try {
      const answer = await interpretSignupAnswer(
        field,
        text,
        controller.signal,
      );
      applied = applyInterpretedAnswer(field, answer, profileRef.current);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        // Sair sem baixar o `typing` deixaria o indicador aceso e o campo
        // travado para sempre — o chat morreria de pé.
        setTyping(false);
        return;
      }
      // O modelo caiu. O cadastro não pode cair junto: o parser local resolve
      // as respostas diretas e a pessoa termina o que começou.
      applied = applyChatAnswer(field, text, profileRef.current);
    }

    const elapsed = Date.now() - startedAt;
    const wait = reduce ? 0 : Math.max(0, MIN_TYPING_MS - elapsed);

    window.setTimeout(() => {
      setTyping(false);
      settle(applied);
    }, wait);
  }

  /** Resposta pelo atalho (calendário, opções, contador): já vem estruturada,
   *  então não gasta uma ida ao modelo. */
  function answerDirectly(answer: SignupAnswer, label: string) {
    if (!field || locked) return;
    push("you", label);
    settle(applyInterpretedAnswer(field, answer, profileRef.current));
  }

  return (
    <SignupShell
      mode="Conversation"
      fixedHeight
      progress={{
        current: review ? CHAT_ORDER.length : fieldIndex + 1,
        total: CHAT_ORDER.length,
      }}
      onBack={onBack}
      footer={
        review ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button tom="claro" largo onClick={onBack}>
              Start over
            </Button>
            <Button tom="sol" largo onClick={() => onFinish(review)}>
              Confirm
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {field && (
              <QuickAnswer
                field={field}
                disabled={locked}
                onAnswer={answerDirectly}
              />
            )}
            <form
              className="flex min-w-0 items-center gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <label className="sr-only" htmlFor="chat-draft">
                Write your answer
              </label>
              <input
                ref={inputRef}
                id="chat-draft"
                className="tv-campo min-w-0 flex-1"
                value={draft}
                maxLength={LIMITS.chat}
                disabled={locked}
                placeholder="Write here…"
                onChange={(event) => setDraft(event.target.value)}
                autoComplete="off"
              />
              <Button
                tom="sol"
                type="submit"
                className="shrink-0 px-5"
                disabled={locked || draft.trim().length === 0}
              >
                <IconSend />
                <span className="sr-only sm:not-sr-only">Send</span>
              </Button>
            </form>
          </div>
        )
      }
    >
      <div
        ref={scrollRef}
        role="log"
        aria-label="Conversation with Brio"
        aria-live="polite"
        aria-relevant="additions"
        className="w-full min-h-0 flex-1 overflow-y-auto"
      >
        <ol className="flex flex-col gap-5 pb-4">
          {log.map((turn) => (
            <MessageRow key={turn.id} turn={turn} name={profile.name} />
          ))}
          {review && (
            <li className="min-w-0">
              <SignupReview profile={review} />
            </li>
          )}
          {/* Sem AnimatePresence de propósito: a animação de saída deixava o
              nó no DOM em opacity 0, e um "está escrevendo" invisível dentro
              de um aria-live é anunciado para sempre por leitor de tela. */}
          {typing && <TypingIndicator />}
        </ol>
      </div>
    </SignupShell>
  );
}
