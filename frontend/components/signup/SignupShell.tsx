import type { ReactNode } from "react";

import { BrandMark } from "@/components/BrandMark";
import { IconBack } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";

type SignupShellProps = {
  /** Name of the signup model, shown at the top. */
  mode: string;
  onBack: () => void;
  progress?: { current: number; total: number };
  /** Main action. Stays in the footer, always in the same place. */
  footer?: ReactNode;
  /** Locks height to the window and lets the content scroll inside. The chat
   *  needs this: without a fixed height the history pushes the page down. */
  fixedHeight?: boolean;
  children: ReactNode;
};

export function SignupShell({
  mode,
  onBack,
  progress,
  footer,
  fixedHeight = false,
  children,
}: SignupShellProps) {
  return (
    <div
      className={`flex flex-col bg-papel ${
        fixedHeight ? "h-svh overflow-hidden" : "min-h-svh"
      }`}
    >
      <header className="border-b border-linha">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-5 py-3">
          <Button tom="nu" onClick={onBack} className="px-3 text-apoio">
            <IconBack className="h-5 w-5" />
            Back
          </Button>
          <BrandMark className="h-8 w-auto" />
          <p className="min-w-0 text-right text-apoio text-suave">{mode}</p>
        </div>
      </header>

      <main
        id="content"
        className={`mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-5 ${
          fixedHeight ? "min-h-0 py-6" : "py-10"
        }`}
      >
        {progress && (
          <div className="mb-10 w-full">
            <ProgressBar atual={progress.current} total={progress.total} />
          </div>
        )}
        {children}
      </main>

      {footer && (
        <footer className="sticky bottom-0 border-t border-linha bg-papel">
          <div className="mx-auto w-full max-w-xl px-5 py-4">{footer}</div>
        </footer>
      )}
    </div>
  );
}
