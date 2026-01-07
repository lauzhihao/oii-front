import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MainLayout from "@/components/layout/MainLayout";
import {
  Roboto, Plus_Jakarta_Sans, Source_Serif_4,
  Noto_Sans, Poppins, Inter, Open_Sans, Nunito_Sans
} from "next/font/google";
import localFont from "next/font/local";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-roboto",
  display: "swap",
  preload: true,
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
  preload: true,
});

const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-source-serif-4",
  display: "swap",
  preload: true,
});

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-noto-sans",
  display: "swap",
  preload: true,
});

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-open-sans",
  display: "swap",
  preload: true,
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", '500', "600", "700"],
  variable: "--font-poppins",
  display: "swap",
  preload: true,
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-nunito-sans",
  display: "swap",
  preload: true,
});

const nicoMoji = localFont({
  src: [
    {
      path: "../../public/font/nicomoji-plus_v2-5.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-nico",
  preload: true,
  display: "swap",
  fallback: ["roboto"],
});


export const metadata: Metadata = {
  title: "Daoer",
  description: "A content community powered by AI Remix",
  keywords: 'tapi, tapi ai, AI Remix, content community, AI assistant',
  openGraph: {
    title: 'Tapi',
    description: 'A content community powered by AI Remix',
    type: 'website',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tapi',
    description: 'A content community powered by AI Remix',
  },
  // Use env for prod domain to generate absolute canonical/OG URLs
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={[
          geistSans.variable,
          geistMono.variable,
          roboto.variable,
          plusJakarta.variable,
          sourceSerif4.variable,
          notoSans.variable,
          poppins.variable,
          nicoMoji.variable,
          openSans.variable,
          inter.variable,
          nunitoSans.variable,
          "antialiased",
          "light",
        ].join(" ")}
      >
        <MainLayout>
          {children}
        </MainLayout>
      </body>
    </html>
  );
}
