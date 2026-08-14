"use client";

import { useState } from "react";

import { IconPin } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Counter } from "@/components/ui/Counter";
import { MultiList, OptionList } from "@/components/ui/OptionList";
import {
  HOBBY_CHIPS,
  LIMITS,
  MARITAL_OPTIONS,
  type MaritalStatus,
} from "@/lib/profile";
import type { ChatField } from "@/lib/signup-chat";
import { lookupPlace, type SignupAnswer } from "@/services/api";

/** Resposta pronta, do mesmo formato que o modelo devolveria. Vai direto para
 *  `applyInterpretedAnswer` — escolher no calendário não precisa passar pela
 *  IA, e mandá-la interpretar o que já está estruturado só somaria espera. */
const empty: SignupAnswer = {
  full_name: null,
  email: null,
  birth_date: null,
  age: null,
  city: null,
  state: null,
  country: null,
  marital_status: null,
  has_minor_children: null,
  minor_children_count: null,
  hobbies: [],
};

type QuickAnswerProps = {
  field: ChatField;
  disabled: boolean;
  /** `label` é o que entra na conversa como fala da pessoa. */
  onAnswer: (answer: SignupAnswer, label: string) => void;
};

const SIM_NAO = [
  { id: "nao" as const, label: "Não tenho" },
  { id: "sim" as const, label: "Sim, tenho" },
];

/** Atalho opcional para a pergunta da vez.
 *
 *  Existe porque escrever data e contagem é justamente onde a digitação mais
 *  cansa e onde o reconhecimento de fala mais erra. Nunca substitui o campo de
 *  texto — os dois caminhos ficam disponíveis ao mesmo tempo. */
export function QuickAnswer({ field, disabled, onAnswer }: QuickAnswerProps) {
  if (field === "birthDate")
    return <QuickDate disabled={disabled} onAnswer={onAnswer} />;
  if (field === "maritalStatus") {
    return <QuickMarital disabled={disabled} onAnswer={onAnswer} />;
  }
  if (field === "children")
    return <QuickChildren disabled={disabled} onAnswer={onAnswer} />;
  if (field === "hobbies")
    return <QuickHobbies disabled={disabled} onAnswer={onAnswer} />;
  if (field === "place")
    return <QuickPlace disabled={disabled} onAnswer={onAnswer} />;
  return null;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full border-t border-linha pt-4">
      <p className="text-apoio text-suave">Se preferir, escolha aqui:</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function QuickDate({ disabled, onAnswer }: Omit<QuickAnswerProps, "field">) {
  const [value, setValue] = useState("");

  return (
    <Frame>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <label className="sr-only" htmlFor="quick-date">
          Data de nascimento
        </label>
        <input
          id="quick-date"
          type="date"
          className="tv-campo max-w-56"
          value={value}
          max={new Date().toISOString().slice(0, 10)}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button
          tom="sol"
          disabled={disabled || !value}
          onClick={() => {
            const [year, month, day] = value.split("-");
            onAnswer(
              { ...empty, birth_date: value },
              `${day}/${month}/${year}`,
            );
            setValue("");
          }}
        >
          Usar esta data
        </Button>
      </div>
    </Frame>
  );
}

function QuickMarital({ disabled, onAnswer }: Omit<QuickAnswerProps, "field">) {
  return (
    <Frame>
      <fieldset disabled={disabled}>
        <OptionList
          legend="Estado civil"
          options={MARITAL_OPTIONS}
          value={null}
          onChange={(id: MaritalStatus) => {
            const chosen = MARITAL_OPTIONS.find((option) => option.id === id);
            onAnswer({ ...empty, marital_status: id }, chosen?.label ?? id);
          }}
          colunas
        />
      </fieldset>
    </Frame>
  );
}

function QuickChildren({
  disabled,
  onAnswer,
}: Omit<QuickAnswerProps, "field">) {
  const [count, setCount] = useState(1);

  return (
    <Frame>
      <fieldset
        disabled={disabled}
        className="flex flex-col items-center gap-4"
      >
        <div className="w-full">
          <OptionList
            legend="Filhos menores de 18 anos"
            options={SIM_NAO}
            value={null}
            onChange={(id) => {
              if (id === "nao") {
                onAnswer(
                  {
                    ...empty,
                    has_minor_children: false,
                    minor_children_count: 0,
                  },
                  "Não tenho",
                );
              }
            }}
          />
        </div>
        <Counter
          label="Se tem, quantos"
          value={count}
          min={1}
          max={LIMITS.children}
          onChange={setCount}
        />
        <Button
          tom="sol"
          disabled={disabled}
          onClick={() =>
            onAnswer(
              {
                ...empty,
                has_minor_children: true,
                minor_children_count: count,
              },
              count === 1
                ? "Tenho 1 filho menor"
                : `Tenho ${count} filhos menores`,
            )
          }
        >
          Confirmar {count}
        </Button>
      </fieldset>
    </Frame>
  );
}

function QuickHobbies({ disabled, onAnswer }: Omit<QuickAnswerProps, "field">) {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <Frame>
      <fieldset
        disabled={disabled}
        className="flex flex-col items-center gap-4"
      >
        <div className="w-full">
          <MultiList
            legend="Hobbies"
            options={HOBBY_CHIPS}
            selected={selected}
            onToggle={(hobby) =>
              setSelected((current) =>
                current.includes(hobby)
                  ? current.filter((item) => item !== hobby)
                  : [...current, hobby].slice(0, LIMITS.hobbies),
              )
            }
          />
        </div>
        <Button
          tom="sol"
          disabled={disabled || selected.length === 0}
          onClick={() => {
            onAnswer({ ...empty, hobbies: selected }, selected.join(", "));
            setSelected([]);
          }}
        >
          Pronto
        </Button>
      </fieldset>
    </Frame>
  );
}

function QuickPlace({ disabled, onAnswer }: Omit<QuickAnswerProps, "field">) {
  const [locating, setLocating] = useState(false);
  const [failed, setFailed] = useState(false);

  function locate() {
    if (!navigator.geolocation) {
      setFailed(true);
      return;
    }
    setLocating(true);
    setFailed(false);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const place = await lookupPlace(
            position.coords.latitude,
            position.coords.longitude,
          );
          onAnswer(
            {
              ...empty,
              city: place.city,
              state: place.state,
              country: place.country,
            },
            `${place.city}, ${place.state}`,
          );
        } catch {
          setFailed(true);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setFailed(true);
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }

  return (
    <Frame>
      <div className="flex flex-col items-center gap-2">
        <Button onClick={locate} disabled={disabled || locating}>
          <IconPin className="h-5 w-5" />
          {locating ? "Procurando…" : "Usar minha localização"}
        </Button>
        {failed && (
          <p className="text-apoio text-suave">
            Não consegui pegar a localização. Pode escrever a cidade.
          </p>
        )}
      </div>
    </Frame>
  );
}
