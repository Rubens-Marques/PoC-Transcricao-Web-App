"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BrandMark } from "@/components/BrandMark";
import { ChatSignup } from "@/components/signup/ChatSignup";
import { WizardSignup } from "@/components/signup/WizardSignup";
import { IconChat, IconSteps } from "@/components/icons";
import { emptyProfile, saveProfile, type TravelyProfile } from "@/lib/profile";

type Mode = "choice" | "wizard" | "chat";

const MODELS = [
  {
    id: "wizard" as const,
    Icon: IconSteps,
    title: "Step by step",
    summary: "One question per screen, with a progress bar.",
  },
  {
    id: "chat" as const,
    Icon: IconChat,
    title: "Conversation",
    summary: "Like a message chat: we ask, you answer.",
  },
];

export function SignupApp() {
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

  /** Going back to the choice clears the draft: both models collect the same
   *  fields, and carrying answers across would spoil the comparison. */
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
      id="content"
      className="mx-auto flex min-h-svh w-full max-w-xl flex-col items-center justify-center px-5 py-12 text-center"
    >
      <BrandMark className="h-10 w-auto" />

      <h1 className="mt-10">Let’s create your account.</h1>
      <p className="mt-4 text-corpo text-suave">
        Seven simple questions, in the way you prefer.
      </p>

      <div className="mt-10 grid w-full gap-3">
        {MODELS.map(({ id, Icon, title, summary }) => (
          <button
            key={id}
            type="button"
            className="tv-opcao flex-col gap-2 py-6"
            onClick={() => setMode(id)}
          >
            <Icon className="h-7 w-7 text-sol-700" />
            <span className="font-display text-titulo">{title}</span>
            <span className="text-apoio text-suave">{summary}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
