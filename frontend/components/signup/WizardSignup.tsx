"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { SignupReview } from "@/components/signup/SignupReview";
import { SignupShell } from "@/components/signup/SignupShell";
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
  { id: "no" as const, label: "I do not" },
  { id: "yes" as const, label: "Yes, I do" },
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
        "This device cannot share your location. You can write it below.",
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
              : "I could not fill that in. You can write the city.",
          );
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setError("Location permission was denied. You can write the city.");
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }

  if (review) {
    return (
      <SignupShell
        mode="Step by step"
        progress={{ current: TOTAL, total: TOTAL }}
        onBack={() => setReview(null)}
        footer={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button tom="claro" largo onClick={onBack}>
              Start over
            </Button>
            <Button tom="sol" largo onClick={() => onFinish(review)}>
              Confirm
            </Button>
          </div>
        }
      >
        <SignupReview profile={review} />
      </SignupShell>
    );
  }

  return (
    <SignupShell
      mode="Step by step"
      progress={{ current: step, total: TOTAL }}
      onBack={() => {
        if (step === 1) {
          onBack();
          return;
        }
        setError(null);
        setStep((current) => current - 1);
      }}
      footer={
        <Button
          tom="sol"
          largo
          type="submit"
          form="wizard"
          disabled={busy || locating}
        >
          {step === TOTAL ? "Review details" : "Continue"}
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
              label="What is your full name?"
              hint="First and last name."
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
              label="What is your email?"
              hint="We only use it to find your account later."
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
              label="When were you born?"
              hint="Day, month, and year."
              type="date"
              value={profile.birthDate}
              autoComplete="bday"
              onChange={(value) => onPatch({ birthDate: value })}
            />
          )}

          {step === 4 && (
            <fieldset className="flex w-full flex-col items-center">
              <legend className="font-display text-titulo">
                Where do you live?
              </legend>
              <p className="mt-2 text-apoio text-suave">
                Use this device’s location, or write it yourself.
              </p>

              <Button
                className="mt-5"
                onClick={fillLocation}
                disabled={locating}
              >
                <IconPin className="h-5 w-5" />
                {locating ? "Looking…" : "Use my location"}
              </Button>

              <div className="mt-8 grid w-full gap-6 sm:grid-cols-2">
                <TextField
                  id="city"
                  label="City"
                  compacto
                  placeholder="Austin"
                  value={profile.city}
                  autoComplete="address-level2"
                  maxLength={LIMITS.place}
                  onChange={(value) => onPatch({ city: value })}
                />
                <TextField
                  id="state"
                  label="State"
                  compacto
                  placeholder="Texas"
                  value={profile.state}
                  autoComplete="address-level1"
                  maxLength={LIMITS.place}
                  onChange={(value) => onPatch({ state: value })}
                />
              </div>
              <div className="mt-6 w-full">
                <TextField
                  id="country"
                  label="Country"
                  compacto
                  placeholder="United States"
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
                What is your marital status?
              </legend>
              <p className="mt-2 text-apoio text-suave">
                Choose what is true for you today.
              </p>
              <div className="mt-8 w-full">
                <OptionList
                  legend="Marital status"
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
                Do you have children under 18?
              </legend>
              <p className="mt-2 text-apoio text-suave">
                This helps us suggest trips with the right company.
              </p>
              <div className="mt-8 w-full">
                <OptionList
                  legend="Children under 18"
                  options={SIM_NAO}
                  value={profile.hasMinorChildren ? "yes" : "no"}
                  onChange={(id) =>
                    onPatch({
                      hasMinorChildren: id === "yes",
                      minorChildrenCount:
                        id === "yes"
                          ? Math.max(1, profile.minorChildrenCount)
                          : 0,
                    })
                  }
                />
              </div>
              {profile.hasMinorChildren && (
                <div className="mt-8">
                  <Counter
                    label="How many children"
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
                What do you like to do?
              </legend>
              <p className="mt-2 text-apoio text-suave">
                Pick as many as you like. This guides the trip suggestions.
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
                  label="Something else, if you want"
                  compacto
                  placeholder="Fishing"
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
    </SignupShell>
  );
}
