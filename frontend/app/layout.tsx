import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Nunito } from "next/font/google";

import "./globals.css";

/** Nunito na marca e nos títulos: terminações arredondadas, olho grande.
 *  Inter no corpo: separa I maiúsculo de l minúsculo de 1 — o detalhe que
 *  decide se a pessoa digita o email certo. */
const nunito = Nunito({
  subsets: ["latin", "latin-ext"],
  weight: ["700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Travely",
  description: "Ache a sua próxima viagem conversando, sem pressa.",
  icons: {
    icon: "/brand/travely-favicon.svg",
    apple: "/brand/travely-icone-1024.png",
  },
};

/** `maximumScale` fica fora de propósito: travar o zoom quebra o recurso de
 *  acessibilidade mais usado por quem tem visão reduzida. */
export const viewport: Viewport = {
  themeColor: "#ffc02e",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${nunito.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        <a href="#conteudo" className="pular">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
