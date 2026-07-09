import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Syne } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "XML Fiscal Intelligence",
  description:
    "Transforme lotes de XML fiscal (NF-e, CT-e, NFS-e) em planilhas, busca avançada e análises premium.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable} ${display.variable} h-full`}>
      <body className="min-h-full antialiased">
        {children}
        <Toaster theme="dark" richColors position="top-right" />
      </body>
    </html>
  );
}
