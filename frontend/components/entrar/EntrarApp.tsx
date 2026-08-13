"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BrandMark } from "@/components/BrandMark";
import { ChatSignup } from "@/components/entrar/ChatSignup";
import { WizardSignup } from "@/components/entrar/WizardSignup";
import { emptyProfile, saveProfile, type TravelyProfile } from "@/lib/profile";

type Mode = "choice" | "wizard" | "chat";

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

  function backToChoice() {
    setMode("choice");
    setProfile(emptyProfile());
  }

  if (mode === "choice") {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col items-center justify-center px-5 py-12 text-center">
        <BrandMark className="h-14 w-auto" />
        <h1 className="font-display mt-8 max-w-[16ch] text-[1.875rem] font-extrabold leading-tight">
          Como você quer começar?
        </h1>
        <div className="mt-10 flex w-full flex-col gap-4">
          <button
            type="button"
            className="btn btn-primary min-h-28 w-full flex-col gap-1 px-6 py-6"
            onClick={() => setMode("wizard")}
          >
            Passo a passo
            <span className="text-lg font-normal">Um campo de cada vez</span>
          </button>
          <button
            type="button"
            className="btn btn-voice min-h-28 w-full flex-col gap-1 px-6 py-6"
            onClick={() => setMode("chat")}
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
      <ChatSignup
        profile={profile}
        onProfile={setProfile}
        onFinish={finish}
        onBack={backToChoice}
      />
    );
  }

  return (
    <WizardSignup
      profile={profile}
      onPatch={patch}
      onFinish={finish}
      onBack={backToChoice}
    />
  );
}
