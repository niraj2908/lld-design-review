import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import { SquareDashedBottomCode } from "lucide-react";
import { MainNav } from "./_components/main-nav";
import "./globals.css";

/*
 * Two real typefaces, self-hosted by next/font so there is no runtime request to a
 * font CDN and no layout shift while they load. IBM Plex is an engineering typeface
 * with a mono companion that actually matches it, which matters here: the product
 * sets everything the learner wrote in mono, beside its own prose in sans.
 */
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "DesignReview",
  description:
    "Practise low-level design and get evidence-backed review feedback you can act on.",
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <header className="masthead">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden="true">
              <SquareDashedBottomCode size={15} strokeWidth={1.75} />
            </span>
            <span className="brand-name">DesignReview</span>
          </Link>
          <MainNav />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
