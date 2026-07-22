import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const APP_BASE_URL = "https://app.fortcordis.com.br";
const APP_PREVIEW_IMAGE = "/brand/fortcordis-logo-oficial.png";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_BASE_URL),
  title: "Fort Cordis",
  description:
    "Cardiologia veterinária integrada, portal para tutores e acesso seguro para clínicas parceiras.",
  applicationName: "Fort Cordis",
  alternates: {
    canonical: APP_BASE_URL,
  },
  icons: {
    icon: [
      {
        url: APP_PREVIEW_IMAGE,
        type: "image/png",
        sizes: "1563x1563",
      },
    ],
    apple: [
      {
        url: APP_PREVIEW_IMAGE,
        sizes: "1563x1563",
      },
    ],
    shortcut: [APP_PREVIEW_IMAGE],
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: APP_BASE_URL,
    siteName: "Fort Cordis",
    title: "Fort Cordis",
    description:
      "Cardiologia veterinária integrada, portal para tutores e acesso seguro para clínicas parceiras.",
    images: [
      {
        url: APP_PREVIEW_IMAGE,
        width: 1563,
        height: 1563,
        alt: "Logomarca Fort Cordis",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fort Cordis",
    description:
      "Cardiologia veterinária integrada, portal para tutores e acesso seguro para clínicas parceiras.",
    images: [APP_PREVIEW_IMAGE],
  },
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
