import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Nunito } from "next/font/google";

import "./globals.css";

const nunito = Nunito({
  subsets: ["latin", "latin-ext"],
  weight: ["800"],
  variable: "--font-nunito",
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Travely",
  description: "Comunidade de viagem para quem quer ir com calma.",
  icons: {
    icon: "/brand/travely-favicon.svg",
    apple: "/brand/travely-icone-1024.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${nunito.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        {/*
THESIS: Two huge doors to join Travely. Refuses the login card, neo-brutalist offset, and Duolingo green.
OWN-WORLD: Paleta Manhã Clara — papel #FFFFFF, azul horizonte #0B5FBF, amarelo manhã #FFC02E, sol e horizonte no símbolo, Nunito 800 + Inter, botão 3D com lábio de 4px, raio 16px.
STORY: Older traveler picks Passo a passo or Conversar, answers name through hobbies, then uses voice search already signed in.
FIRST VIEWPORT: Logo horizontal, headline Como você quer começar?, blue door and yellow door, helper line.
FORM: Brand kit v1 (files.zip); composition F two buttons; seed d64e51d7.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
        */}
        {children}
      </body>
    </html>
  );
}
