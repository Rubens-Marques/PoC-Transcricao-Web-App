"use client";

import { useEffect, useRef, useState } from "react";

import { EntrarField } from "@/components/entrar/EntrarField";
import { EntrarHeader } from "@/components/entrar/EntrarHeader";
import {
  HOBBY_CHIPS,
  LIMITS,
  MARITAL_OPTIONS,
  validateWizardStep,
  type TravelyProfile,
} from "@/lib/profile";
import { lookupPlace } from "@/services/api";

const WIZARD_TOTAL = 7;

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
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [hobbyExtra, setHobbyExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function wizardNext() {
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
    if (step === WIZARD_TOTAL) {
      setBusy(true);
      onFinish(withExtra);
      return;
    }
    setStep((current) => current + 1);
  }

  function fillLocation() {
    if (!navigator.geolocation) {
      setError("Este aparelho não informa localização. Pode escrever.");
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
          const place = await lookupPlace(
            position.coords.latitude,
            position.coords.longitude,
            controller.signal,
          );
          onPatch(place);
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

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-5 py-8">
      <EntrarHeader
        onBack={() => {
          if (step === 1) {
            onBack();
            return;
          }
          setError(null);
          setStep((current) => current - 1);
        }}
        note={`Pergunta ${step} de ${WIZARD_TOTAL}`}
        progress={step / WIZARD_TOTAL}
      />

      <form
        className="mt-10 flex flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          wizardNext();
        }}
      >
        {step === 1 && (
          <EntrarField
            id="name"
            label="Qual é o seu nome?"
            value={profile.name}
            autoComplete="name"
            maxLength={LIMITS.name}
            onChange={(value) => onPatch({ name: value })}
          />
        )}
        {step === 2 && (
          <EntrarField
            id="email"
            label="Qual é o seu email?"
            type="email"
            value={profile.email}
            autoComplete="email"
            maxLength={LIMITS.email}
            onChange={(value) => onPatch({ email: value })}
          />
        )}
        {step === 3 && (
          <EntrarField
            id="birthDate"
            label="Qual é a sua data de nascimento?"
            type="date"
            value={profile.birthDate}
            onChange={(value) => onPatch({ birthDate: value })}
          />
        )}
        {step === 4 && (
          <fieldset>
            <legend className="font-display text-[1.875rem] font-extrabold leading-tight">
              Onde você mora?
            </legend>
            <button
              type="button"
              className="btn btn-ghost mt-6 px-4 py-3 text-lg"
              onClick={fillLocation}
              disabled={locating}
            >
              {locating ? "Procurando…" : "Usar minha localização"}
            </button>
            <div className="mt-6 grid gap-5">
              <EntrarField
                id="city"
                label="Cidade"
                compact
                value={profile.city}
                autoComplete="address-level2"
                maxLength={LIMITS.place}
                onChange={(value) => onPatch({ city: value })}
              />
              <EntrarField
                id="state"
                label="Estado"
                compact
                value={profile.state}
                autoComplete="address-level1"
                maxLength={LIMITS.place}
                onChange={(value) => onPatch({ state: value })}
              />
              <EntrarField
                id="country"
                label="País"
                compact
                value={profile.country}
                autoComplete="country-name"
                maxLength={LIMITS.place}
                onChange={(value) => onPatch({ country: value })}
              />
            </div>
          </fieldset>
        )}
        {step === 5 && (
          <fieldset>
            <legend className="font-display text-[1.875rem] font-extrabold leading-tight">
              Qual é o seu estado civil?
            </legend>
            <div className="mt-8 grid gap-3">
              {MARITAL_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`btn min-h-16 px-4 py-3 text-left text-xl ${
                    profile.maritalStatus === option.id
                      ? "chip-on"
                      : "btn-ghost"
                  }`}
                  onClick={() => onPatch({ maritalStatus: option.id })}
                  aria-pressed={profile.maritalStatus === option.id}
                >
                  {profile.maritalStatus === option.id ? "✓ " : ""}
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {step === 6 && (
          <fieldset>
            <legend className="font-display text-[1.875rem] font-extrabold leading-tight">
              Você tem filhos menores?
            </legend>
            <div className="mt-8 flex gap-4">
              <button
                type="button"
                className={`btn min-h-16 flex-1 text-xl ${
                  profile.hasMinorChildren ? "btn-ghost" : "chip-on"
                }`}
                onClick={() =>
                  onPatch({ hasMinorChildren: false, minorChildrenCount: 0 })
                }
                aria-pressed={!profile.hasMinorChildren}
              >
                Não
                {!profile.hasMinorChildren ? " ✓" : ""}
              </button>
              <button
                type="button"
                className={`btn min-h-16 flex-1 text-xl ${
                  profile.hasMinorChildren ? "chip-on" : "btn-ghost"
                }`}
                onClick={() =>
                  onPatch({
                    hasMinorChildren: true,
                    minorChildrenCount: Math.max(1, profile.minorChildrenCount),
                  })
                }
                aria-pressed={profile.hasMinorChildren}
              >
                Sim
                {profile.hasMinorChildren ? " ✓" : ""}
              </button>
            </div>
            {profile.hasMinorChildren && (
              <div className="mt-8">
                <p className="text-xl font-bold" id="children-count-label">
                  Quantos?
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <button
                    type="button"
                    className="btn btn-ghost h-16 w-16 text-3xl"
                    onClick={() =>
                      onPatch({
                        minorChildrenCount: Math.max(
                          1,
                          profile.minorChildrenCount - 1,
                        ),
                      })
                    }
                    aria-label="Diminuir"
                  >
                    −
                  </button>
                  <p
                    className="min-w-12 text-center text-4xl font-bold"
                    aria-labelledby="children-count-label"
                  >
                    {profile.minorChildrenCount}
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost h-16 w-16 text-3xl"
                    onClick={() =>
                      onPatch({
                        minorChildrenCount: Math.min(
                          LIMITS.children,
                          profile.minorChildrenCount + 1,
                        ),
                      })
                    }
                    aria-label="Aumentar"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </fieldset>
        )}
        {step === 7 && (
          <fieldset>
            <legend className="font-display text-[1.875rem] font-extrabold leading-tight">
              O que você gosta de fazer?
            </legend>
            <div className="mt-8 flex flex-wrap gap-3">
              {HOBBY_CHIPS.map((hobby) => {
                const on = profile.hobbies.includes(hobby);
                return (
                  <button
                    key={hobby}
                    type="button"
                    className={`btn px-4 py-3 text-lg ${
                      on ? "chip-on" : "btn-ghost"
                    }`}
                    aria-pressed={on}
                    onClick={() =>
                      onPatch({
                        hobbies: on
                          ? profile.hobbies.filter((item) => item !== hobby)
                          : [...profile.hobbies, hobby].slice(
                              0,
                              LIMITS.hobbies,
                            ),
                      })
                    }
                  >
                    {on ? "✓ " : ""}
                    {hobby}
                  </button>
                );
              })}
            </div>
            <div className="mt-6">
              <EntrarField
                id="hobbyExtra"
                label="Outro, se quiser"
                compact
                value={hobbyExtra}
                maxLength={LIMITS.hobby}
                onChange={setHobbyExtra}
              />
            </div>
          </fieldset>
        )}

        {error && (
          <p
            role="alert"
            className="btn-warn mt-6 rounded-2xl px-4 py-3 text-left text-lg"
          >
            {error}
          </p>
        )}

        <div className="mt-auto flex gap-4 pt-10">
          <button
            type="submit"
            className="btn btn-primary min-h-16 flex-1 text-2xl"
            disabled={busy || locating}
          >
            {step === WIZARD_TOTAL ? "Criar conta" : "Continuar"}
          </button>
        </div>
      </form>
    </main>
  );
}
