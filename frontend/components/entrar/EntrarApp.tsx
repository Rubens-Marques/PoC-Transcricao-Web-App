"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BrandMark } from "@/components/BrandMark";
import { ChatSignup } from "@/components/entrar/ChatSignup";
import { WizardSignup } from "@/components/entrar/WizardSignup";
import { IconChat, IconSteps } from "@/components/icons";
import { emptyProfile, saveProfile, type TravelyProfile } from "@/lib/profile";

type Mode = "choice" | "wizard" | "chat";

const MODELOS = [
  {
    id: "wizard" as const,
    Icon: IconSteps,
    titulo: "Passo a passo",
    resumo: "Uma pergunta por tela, com barra de progresso.",
  },
  {
    id: "chat" as const,
    Icon: IconChat,
    titulo: "Conversando",
    resumo: "Como uma conversa de mensagem: a gente pergunta, você responde.",
  },
];

export function EntrarApp() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choice");
  const [profile, setProfile] = useState<TravelyProfile>(emptyProfile);

  function finish(next: TravelyProfile) {
    saveProfile(next);
    router.push("/");
  }

  function patch(partial: Partial<TravelyProfile>) {
    setProfile((current) => ({ ...current, ...partial }));
  }

  /** Voltar para a escolha zera o rascunho: os dois modelos coletam os mesmos
   *  campos, e carregar respostas de um para o outro falsearia a comparação. */
  function backToChoice() {
    setMode("choice");
    setProfile(emptyProfile());
  }

  if (mode === "chat") {
    return (
      <ChatSignup
        profile={profile}
        onProfile={setProfile}
        onFinish={finish}
        onBack={backToChoice}
      />
    );
  }

  if (mode === "wizard") {
    return (
      <WizardSignup
        profile={profile}
        onPatch={patch}
        onFinish={finish}
        onBack={backToChoice}
      />
    );
  }

  return (
    <main
      id="conteudo"
      className="mx-auto flex min-h-svh w-full max-w-xl flex-col items-center justify-center px-5 py-12 text-center"
    >
      <BrandMark className="h-10 w-auto" />

      <h1 className="mt-10">Vamos criar a sua conta.</h1>
      <p className="mt-4 text-corpo text-suave">
        São sete perguntas simples, do jeito que você preferir.
      </p>

      <div className="mt-10 grid w-full gap-3">
        {MODELOS.map(({ id, Icon, titulo, resumo }) => (
          <button
            key={id}
            type="button"
            className="tv-opcao flex-col gap-2 py-6"
            onClick={() => setMode(id)}
          >
            <Icon className="h-7 w-7 text-sol-700" />
            <span className="font-display text-titulo">{titulo}</span>
            <span className="text-apoio text-suave">{resumo}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
