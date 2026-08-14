"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { EntrarShell } from "@/components/entrar/EntrarShell";
import { SignupReview } from "@/components/entrar/SignupReview";
import { IconPin } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Counter } from "@/components/ui/Counter";
import { MultiList, OptionList } from "@/components/ui/OptionList";
import { TextField } from "@/components/ui/TextField";
import {
  HOBBY_CHIPS,
  LIMITS,
  MARITAL_OPTIONS,
  validateWizardStep,
  type TravelyProfile,
} from "@/lib/profile";
import { lookupPlace } from "@/services/api";

const TOTAL = 7;

const SIM_NAO = [
  { id: "nao" as const, label: "Não tenho" },
  { id: "sim" as const, label: "Sim, tenho" },
];

export function WizardSignup({
  profile,
  onPatch,
  onFinish,
  onBack,
}: {
  profile: TravelyProfile;
  onPatch: (partial: Partial<TravelyProfile>) => void;
  onFinish: (next: TravelyProfile) => void;
  onBack: () => void;
}) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [hobbyExtra, setHobbyExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<TravelyProfile | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const passoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  /** Cada passo troca o conteúdo sem trocar de URL, então o foco ficaria preso
   *  no botão do passo anterior. Movê-lo para o topo faz o leitor de tela
   *  anunciar a pergunta nova. */
  useEffect(() => {
    passoRef.current?.focus();
  }, [step]);

  function next() {
    if (busy) return;

    const extra = hobbyExtra.trim().slice(0, LIMITS.hobby);
    const withExtra =
      step === 7 && extra
        ? {
            ...profile,
            hobbies: Array.from(new Set([...profile.hobbies, extra])).slice(
              0,
              LIMITS.hobbies,
            ),
          }
        : profile;

    const message = validateWizardStep(step, withExtra);
    if (message) {
      setError(message);
      return;
    }

    setError(null);
    if (step === TOTAL) {
      setReview(withExtra);
      return;
    }
    setStep((current) => current + 1);
  }

  function fillLocation() {
    if (!navigator.geolocation) {
      setError(
        "Este aparelho não informa a localização. Pode escrever abaixo.",
      );
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          onPatch(
            await lookupPlace(
              position.coords.latitude,
              position.coords.longitude,
              controller.signal,
            ),
          );
        } catch (caught) {
          if (caught instanceof DOMException && caught.name === "AbortError") {
            return;
          }
          setError(
            caught instanceof Error
              ? caught.message
              : "Não consegui preencher sozinho. Pode escrever a cidade.",
          );
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setError("Sem permissão de localização. Pode escrever a cidade.");
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }

  if (review) {
    return (
      <EntrarShell
        modo="Passo a passo"
        progresso={{ atual: TOTAL, total: TOTAL }}
        onBack={() => setReview(null)}
        rodape={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button tom="claro" largo onClick={onBack}>
              Refazer o cadastro
            </Button>
            <Button tom="sol" largo onClick={() => onFinish(review)}>
              Confirmar
            </Button>
          </div>
        }
      >
        <SignupReview profile={review} />
      </EntrarShell>
    );
  }

  return (
    <EntrarShell
      modo="Passo a passo"
      progresso={{ atual: step, total: TOTAL }}
      onBack={() => {
        if (step === 1) {
          onBack();
          return;
        }
        setError(null);
        setStep((current) => current - 1);
      }}
      rodape={
        <Button
          tom="sol"
          largo
          type="submit"
          form="wizard"
          disabled={busy || locating}
        >
          {step === TOTAL ? "Conferir dados" : "Continuar"}
        </Button>
      }
    >
      <form
        id="wizard"
        className="w-full"
        onSubmit={(event) => {
          event.preventDefault();
          next();
        }}
      >
        <motion.div
          key={step}
          ref={passoRef}
          tabIndex={-1}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="flex w-full flex-col items-center text-center outline-none"
        >
          {step === 1 && (
            <TextField
              id="name"
              label="Qual o seu nome completo?"
              hint="Nome e sobrenome."
              placeholder="Maria Silva"
              value={profile.name}
              autoComplete="name"
              maxLength={LIMITS.name}
              onChange={(value) => onPatch({ name: value })}
            />
          )}

          {step === 2 && (
            <TextField
              id="email"
              label="Qual é o seu email?"
              hint="A gente usa só para achar a sua conta depois."
              placeholder="maria@email.com"
              type="email"
              value={profile.email}
              autoComplete="email"
              maxLength={LIMITS.email}
              onChange={(value) => onPatch({ email: value })}
            />
          )}

          {step === 3 && (
            <TextField
              id="birthDate"
              label="Quando você nasceu?"
              hint="Dia, mês e ano."
              type="date"
              value={profile.birthDate}
              autoComplete="bday"
              onChange={(value) => onPatch({ birthDate: value })}
            />
          )}

          {step === 4 && (
            <fieldset className="flex w-full flex-col items-center">
              <legend className="font-display text-titulo">
                Onde você mora?
              </legend>
              <p className="mt-2 text-apoio text-suave">
                Use a localização do aparelho ou escreva você mesmo.
              </p>

              <Button
                className="mt-5"
                onClick={fillLocation}
                disabled={locating}
              >
                <IconPin className="h-5 w-5" />
                {locating ? "Procurando…" : "Usar minha localização"}
              </Button>

              <div className="mt-8 grid w-full gap-6 sm:grid-cols-2">
                <TextField
                  id="city"
                  label="Cidade"
                  compacto
                  placeholder="Campinas"
                  value={profile.city}
                  autoComplete="address-level2"
                  maxLength={LIMITS.place}
                  onChange={(value) => onPatch({ city: value })}
                />
                <TextField
                  id="state"
                  label="Estado"
                  compacto
                  placeholder="São Paulo"
                  value={profile.state}
                  autoComplete="address-level1"
                  maxLength={LIMITS.place}
                  onChange={(value) => onPatch({ state: value })}
                />
              </div>
              <div className="mt-6 w-full">
                <TextField
                  id="country"
                  label="País"
                  compacto
                  placeholder="Brasil"
                  value={profile.country}
                  autoComplete="country-name"
                  maxLength={LIMITS.place}
                  onChange={(value) => onPatch({ country: value })}
                />
              </div>
            </fieldset>
          )}

          {step === 5 && (
            <fieldset className="flex w-full flex-col items-center">
              <legend className="font-display text-titulo">
                Qual é o seu estado civil?
              </legend>
              <p className="mt-2 text-apoio text-suave">
                Escolha o que vale para você hoje.
              </p>
              <div className="mt-8 w-full">
                <OptionList
                  legend="Estado civil"
                  options={MARITAL_OPTIONS}
                  value={profile.maritalStatus}
                  onChange={(id) => onPatch({ maritalStatus: id })}
                  colunas
                />
              </div>
            </fieldset>
          )}

          {step === 6 && (
            <fieldset className="flex w-full flex-col items-center">
              <legend className="font-display text-titulo">
                Você tem filhos menores de 18 anos?
              </legend>
              <p className="mt-2 text-apoio text-suave">
                Isso ajuda a sugerir viagens com a companhia certa.
              </p>
              <div className="mt-8 w-full">
                <OptionList
                  legend="Filhos menores"
                  options={SIM_NAO}
                  value={profile.hasMinorChildren ? "sim" : "nao"}
                  onChange={(id) =>
                    onPatch({
                      hasMinorChildren: id === "sim",
                      minorChildrenCount:
                        id === "sim"
                          ? Math.max(1, profile.minorChildrenCount)
                          : 0,
                    })
                  }
                />
              </div>
              {profile.hasMinorChildren && (
                <div className="mt-8">
                  <Counter
                    label="Quantos filhos"
                    value={profile.minorChildrenCount}
                    min={1}
                    max={LIMITS.children}
                    onChange={(value) => onPatch({ minorChildrenCount: value })}
                  />
                </div>
              )}
            </fieldset>
          )}

          {step === 7 && (
            <fieldset className="flex w-full flex-col items-center">
              <legend className="font-display text-titulo">
                O que você gosta de fazer?
              </legend>
              <p className="mt-2 text-apoio text-suave">
                Marque quantos quiser. Isso guia as sugestões de viagem.
              </p>
              <div className="mt-8 w-full">
                <MultiList
                  legend="Hobbies"
                  options={HOBBY_CHIPS}
                  selected={profile.hobbies}
                  onToggle={(hobby) =>
                    onPatch({
                      hobbies: profile.hobbies.includes(hobby)
                        ? profile.hobbies.filter((item) => item !== hobby)
                        : [...profile.hobbies, hobby].slice(0, LIMITS.hobbies),
                    })
                  }
                />
              </div>
              <div className="mt-8 w-full">
                <TextField
                  id="hobbyExtra"
                  label="Outro, se quiser"
                  compacto
                  placeholder="Pesca"
                  value={hobbyExtra}
                  maxLength={LIMITS.hobby}
                  onChange={setHobbyExtra}
                />
              </div>
            </fieldset>
          )}

          {error && (
            <div className="mt-6 w-full">
              <Callout tom="erro">{error}</Callout>
            </div>
          )}
        </motion.div>
      </form>
    </EntrarShell>
  );
}
