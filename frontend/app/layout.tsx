import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FortCordis",
  description: "Sistema de gestao para clinicas veterinarias",
  other: {
    google: "notranslate",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" translate="no" className="notranslate" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased notranslate`}
        translate="no"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
