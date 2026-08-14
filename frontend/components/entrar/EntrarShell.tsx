import type { ReactNode } from "react";

import { BrandMark } from "@/components/BrandMark";
import { IconBack } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";

type EntrarShellProps = {
  /** Nome do modelo em teste, mostrado no topo. */
  modo: string;
  onBack: () => void;
  progresso?: { atual: number; total: number };
  /** Ação principal da tela. Fica no rodapé, sempre no mesmo lugar. */
  rodape?: ReactNode;
  /** Prende a altura na janela e deixa o conteúdo rolar por dentro. O chat
   *  precisa disso: sem altura fixa o histórico empurra a página para baixo,
   *  a rolagem automática não tem o que rolar e a mensagem nova nasce fora
   *  da tela. O wizard não usa — lá quem rola é a página. */
  alturaFixa?: boolean;
  children: ReactNode;
};

/** Casca compartilhada pelos dois modelos de cadastro. Mantém topo, largura de
 *  leitura e posição da ação principal idênticos entre eles — é o que permite
 *  comparar wizard e conversa sem que a diferença de moldura contamine o teste. */
export function EntrarShell({
  modo,
  onBack,
  progresso,
  rodape,
  alturaFixa = false,
  children,
}: EntrarShellProps) {
  return (
    <div
      className={`flex flex-col bg-papel ${
        alturaFixa ? "h-svh overflow-hidden" : "min-h-svh"
      }`}
    >
      <header className="border-b border-linha">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-5 py-3">
          <Button tom="nu" onClick={onBack} className="px-3 text-apoio">
            <IconBack className="h-5 w-5" />
            Voltar
          </Button>
          <BrandMark className="h-8 w-auto" />
          <p className="min-w-0 text-right text-apoio text-suave">{modo}</p>
        </div>
      </header>

      <main
        id="conteudo"
        className={`mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-5 ${
          alturaFixa ? "min-h-0 py-6" : "py-10"
        }`}
      >
        {progresso && (
          <div className="mb-10 w-full">
            <ProgressBar atual={progresso.atual} total={progresso.total} />
          </div>
        )}
        {children}
      </main>

      {rodape && (
        <footer className="sticky bottom-0 border-t border-linha bg-papel">
          <div className="mx-auto w-full max-w-xl px-5 py-4">{rodape}</div>
        </footer>
      )}
    </div>
  );
}
