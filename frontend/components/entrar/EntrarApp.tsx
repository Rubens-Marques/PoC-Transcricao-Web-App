"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { BrandMark } from "@/components/BrandMark";

import {
  HOBBY_CHIPS,
  MARITAL_OPTIONS,
  emptyProfile,
  isValidEmail,
  saveProfile,
  type TravelyProfile,
} from "@/lib/profile";
import {
  parseBirthDate,
  parseChildren,
  parseEmail,
  parseHobbies,
  parseMaritalStatus,
  parsePlace,
} from "@/lib/signup-chat";

type Mode = "choice" | "wizard" | "chat";

type ChatTurn = { from: "bot" | "you"; text: string };

type ChatField =
  | "name"
  | "email"
  | "birthDate"
  | "place"
  | "maritalStatus"
  | "children"
  | "hobbies";

const WIZARD_TOTAL = 7;

const CHAT_PROMPTS: Record<ChatField, string> = {
  name: "Olá. Qual é o seu nome?",
  email: "Qual é o seu email?",
  birthDate: "Em que dia você nasceu? Pode dizer 15/03/1952, por exemplo.",
  place:
    "Onde você mora? Cidade, estado e país. Se quiser, escreva tudo numa frase.",
  maritalStatus: "Qual é o seu estado civil hoje?",
  children: "Você tem filhos menores? Se sim, quantos?",
  hobbies: "O que você gosta de fazer? Pode listar alguns hobbies.",
};

const CHAT_ORDER: ChatField[] = [
  "name",
  "email",
  "birthDate",
  "place",
  "maritalStatus",
  "children",
  "hobbies",
];

export function EntrarApp() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choice");
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<TravelyProfile>(emptyProfile);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [hobbyExtra, setHobbyExtra] = useState("");
  const [chatFieldIndex, setChatFieldIndex] = useState(0);
  const [chatDraft, setChatDraft] = useState("");
  const [chatLog, setChatLog] = useState<ChatTurn[]>([
    { from: "bot", text: CHAT_PROMPTS.name },
  ]);

  const chatField = CHAT_ORDER[chatFieldIndex];

  function finish(next: TravelyProfile) {
    saveProfile(next);
    router.push("/");
  }

  function patch(partial: Partial<TravelyProfile>) {
    setProfile((current) => ({ ...current, ...partial }));
  }

  function wizardNext() {
    const withExtra =
      step === 7 && hobbyExtra.trim()
        ? {
            ...profile,
            hobbies: Array.from(
              new Set([...profile.hobbies, hobbyExtra.trim()]),
            ),
          }
        : profile;
    const message = validateStep(step, withExtra);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    if (step === WIZARD_TOTAL) {
      finish(withExtra);
      return;
    }
    setProfile(withExtra);
    setStep((current) => current + 1);
  }

  async function fillLocation() {
    if (!navigator.geolocation) {
      setError("Este aparelho não informa localização. Pode escrever.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.coords.latitude}&lon=${position.coords.longitude}`;
          const response = await fetch(url, {
            headers: { Accept: "application/json" },
          });
          if (!response.ok) throw new Error("lookup failed");
          const data = (await response.json()) as {
            address?: {
              city?: string;
              town?: string;
              village?: string;
              state?: string;
              country?: string;
            };
          };
          const address = data.address ?? {};
          patch({
            city: address.city || address.town || address.village || "",
            state: address.state || "",
            country: address.country || "Brasil",
          });
        } catch {
          setError("Não consegui preencher sozinho. Pode escrever a cidade.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setError("Sem permissão de localização. Pode escrever a cidade.");
      },
    );
  }

  function sendChat() {
    const text = chatDraft.trim();
    if (!text || !chatField) return;

    const applied = applyChatAnswer(chatField, text, profile);
    if (!applied.ok) {
      setChatLog((log) => [
        ...log,
        { from: "you", text },
        { from: "bot", text: applied.message },
      ]);
      setChatDraft("");
      return;
    }

    const nextProfile = applied.profile;
    setProfile(nextProfile);
    setChatDraft("");

    if (chatFieldIndex === CHAT_ORDER.length - 1) {
      setChatLog((log) => [
        ...log,
        { from: "you", text },
        {
          from: "bot",
          text: `Pronto, ${nextProfile.name}. Vou abrir a busca por voz.`,
        },
      ]);
      window.setTimeout(() => finish(nextProfile), 700);
      return;
    }

    const nextField = CHAT_ORDER[chatFieldIndex + 1];
    if (!nextField) return;
    setChatFieldIndex((index) => index + 1);
    setChatLog((log) => [
      ...log,
      { from: "you", text },
      { from: "bot", text: CHAT_PROMPTS[nextField] },
    ]);
  }

  const progressLabel = useMemo(
    () => `Pergunta ${step} de ${WIZARD_TOTAL}`,
    [step],
  );

  if (mode === "choice") {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col items-center justify-center px-5 py-12 text-center">
        <BrandMark className="h-14 w-auto" />
        <h1 className="font-display mt-8 max-w-[16ch] text-[1.875rem] font-extrabold leading-tight sm:text-[1.875rem]">
          Como você quer começar?
        </h1>
        <div className="mt-10 flex w-full flex-col gap-4">
          <button
            type="button"
            className="btn btn-primary min-h-28 w-full flex-col gap-1 px-6 py-6"
            onClick={() => {
              setMode("wizard");
              setStep(1);
              setError(null);
            }}
          >
            Passo a passo
            <span className="text-lg font-normal">Um campo de cada vez</span>
          </button>
          <button
            type="button"
            className="btn btn-voice min-h-28 w-full flex-col gap-1 px-6 py-6"
            onClick={() => {
              setMode("chat");
              setError(null);
            }}
          >
            Conversar
            <span className="text-lg font-normal">
              A gente pergunta. Você responde.
            </span>
          </button>
        </div>
        <p className="mt-8 px-1 text-[1.125rem] font-normal text-muted">
          Escolha um. Depois a gente vai devagar.
        </p>
      </main>
    );
  }

  if (mode === "chat") {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-5 py-8">
        <Header
          onBack={() => {
            setMode("choice");
            setChatFieldIndex(0);
            setChatLog([{ from: "bot", text: CHAT_PROMPTS.name }]);
            setChatDraft("");
          }}
          note="Conversar"
        />
        <ol className="mt-8 flex flex-1 flex-col gap-4">
          {chatLog.map((turn, index) => (
            <li
              key={`${turn.from}-${index}`}
              className={turn.from === "bot" ? "self-start" : "self-end"}
            >
              <p
                className={
                  turn.from === "bot"
                    ? "max-w-[40ch] rounded-2xl rounded-bl-md bg-sand px-4 py-3 text-left text-xl font-normal"
                    : "max-w-[40ch] rounded-2xl rounded-br-md bg-sun-soft px-4 py-3 text-left text-xl font-normal"
                }
              >
                <span className="sr-only">
                  {turn.from === "bot" ? "Travely: " : "Você: "}
                </span>
                {turn.text}
              </p>
            </li>
          ))}
        </ol>
        <form
          className="sticky bottom-0 mt-8 flex gap-3 bg-panel py-4"
          onSubmit={(event) => {
            event.preventDefault();
            sendChat();
          }}
        >
          <label className="sr-only" htmlFor="chat-draft">
            Sua resposta
          </label>
          <input
            id="chat-draft"
            className="field"
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn btn-primary min-h-16 px-6 text-xl"
          >
            Enviar
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-5 py-8">
      <Header
        onBack={() => {
          if (step === 1) {
            setMode("choice");
            return;
          }
          setError(null);
          setStep((current) => current - 1);
        }}
        note={progressLabel}
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
          <Field
            id="name"
            label="Qual é o seu nome?"
            value={profile.name}
            autoComplete="name"
            onChange={(value) => patch({ name: value })}
          />
        )}
        {step === 2 && (
          <Field
            id="email"
            label="Qual é o seu email?"
            type="email"
            value={profile.email}
            autoComplete="email"
            onChange={(value) => patch({ email: value })}
          />
        )}
        {step === 3 && (
          <Field
            id="birthDate"
            label="Qual é a sua data de nascimento?"
            type="date"
            value={profile.birthDate}
            onChange={(value) => patch({ birthDate: value })}
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
              onClick={() => void fillLocation()}
              disabled={locating}
            >
              {locating ? "Procurando…" : "Usar minha localização"}
            </button>
            <div className="mt-6 grid gap-5">
              <Field
                id="city"
                label="Cidade"
                value={profile.city}
                autoComplete="address-level2"
                onChange={(value) => patch({ city: value })}
              />
              <Field
                id="state"
                label="Estado"
                value={profile.state}
                autoComplete="address-level1"
                onChange={(value) => patch({ state: value })}
              />
              <Field
                id="country"
                label="País"
                value={profile.country}
                autoComplete="country-name"
                onChange={(value) => patch({ country: value })}
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
                  onClick={() => patch({ maritalStatus: option.id })}
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
                  patch({ hasMinorChildren: false, minorChildrenCount: 0 })
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
                  patch({
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
                      patch({
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
                      patch({
                        minorChildrenCount: profile.minorChildrenCount + 1,
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
                      patch({
                        hobbies: on
                          ? profile.hobbies.filter((item) => item !== hobby)
                          : [...profile.hobbies, hobby],
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
              <Field
                id="hobbyExtra"
                label="Outro, se quiser"
                value={hobbyExtra}
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
          >
            {step === WIZARD_TOTAL ? "Criar conta" : "Continuar"}
          </button>
        </div>
      </form>
    </main>
  );
}

function Header({
  onBack,
  note,
  progress,
}: {
  onBack: () => void;
  note: string;
  progress?: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          className="btn btn-ghost px-4 py-2 text-lg"
          onClick={onBack}
        >
          Voltar
        </button>
        <BrandMark variant="symbol" className="h-12 w-12" />
        <p className="text-lg text-muted">{note}</p>
      </div>
      {progress != null && (
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Progresso do cadastro"
        >
          <div
            className="progress-fill"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-display text-[1.875rem] font-extrabold leading-tight"
      >
        {label}
      </label>
      <input
        id={id}
        className="field mt-6"
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function validateStep(step: number, profile: TravelyProfile): string | null {
  if (step === 1 && profile.name.trim().length < 2) {
    return "Escreva o nome completo, por favor.";
  }
  if (step === 2 && !isValidEmail(profile.email)) {
    return "Esse email parece incompleto. Falta o @ ou o resto depois dele.";
  }
  if (step === 3 && !profile.birthDate) {
    return "Escolha o dia, o mês e o ano.";
  }
  if (step === 4 && (!profile.city.trim() || !profile.state.trim())) {
    return "Pode escrever a cidade e o estado.";
  }
  if (step === 7 && profile.hobbies.length === 0) {
    return "Escolha pelo menos uma coisa que você gosta de fazer.";
  }
  return null;
}

function applyChatAnswer(
  field: ChatField,
  text: string,
  profile: TravelyProfile,
): { ok: true; profile: TravelyProfile } | { ok: false; message: string } {
  if (field === "name") {
    if (text.trim().length < 2) {
      return {
        ok: false,
        message: "Não entendi o nome. Pode escrever de novo?",
      };
    }
    return { ok: true, profile: { ...profile, name: text.trim() } };
  }
  if (field === "email") {
    const email = parseEmail(text);
    if (!email) {
      return {
        ok: false,
        message: "Não achei um email nisso. Algo como nome@email.com.",
      };
    }
    return { ok: true, profile: { ...profile, email } };
  }
  if (field === "birthDate") {
    const birthDate = parseBirthDate(text);
    if (!birthDate) {
      return {
        ok: false,
        message: "Não peguei a data. Pode ser 15/03/1952.",
      };
    }
    return { ok: true, profile: { ...profile, birthDate } };
  }
  if (field === "place") {
    const place = parsePlace(text);
    if (!place.city) {
      return {
        ok: false,
        message:
          "Pode dizer a cidade e o estado? Exemplo: Campinas, São Paulo, Brasil.",
      };
    }
    return { ok: true, profile: { ...profile, ...place } };
  }
  if (field === "maritalStatus") {
    const maritalStatus = parseMaritalStatus(text);
    if (!maritalStatus) {
      return {
        ok: false,
        message:
          "Pode ser solteiro, casado, união estável, divorciado ou viúvo.",
      };
    }
    return { ok: true, profile: { ...profile, maritalStatus } };
  }
  if (field === "children") {
    const children = parseChildren(text);
    if (!children) {
      return {
        ok: false,
        message: "Responda não, ou sim e o número. Exemplo: tenho 2.",
      };
    }
    return { ok: true, profile: { ...profile, ...children } };
  }
  const hobbies = parseHobbies(text);
  if (hobbies.length === 0) {
    return {
      ok: false,
      message: "Diga uma ou duas coisas que você gosta de fazer.",
    };
  }
  return { ok: true, profile: { ...profile, hobbies } };
}
