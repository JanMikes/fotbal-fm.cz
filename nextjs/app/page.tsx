"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { useUser } from "@/contexts/UserContext";

export default function Home() {
  const { user, loading } = useUser();

  return (
    <div className="bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <h1 className="text-5xl md:text-6xl font-bold text-text-primary mb-6 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Vítejte v MFK FM
          </h1>
          <p className="text-xl md:text-2xl text-text-secondary mb-10 max-w-2xl mx-auto">
            Moderní firemní aplikace pro správu a organizaci
          </p>

          {!loading && !user && (
            <div className="flex justify-center gap-4 flex-wrap">
              <Link href="/prihlaseni">
                <Button variant="primary" size="lg">
                  Přihlásit se
                </Button>
              </Link>
              <Link href="/registrace">
                <Button variant="accent" size="lg">
                  Zaregistrovat se
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Features Grid */}
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <div className="bg-surface border border-border p-8 rounded-xl hover:border-border-light transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 group">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-text-primary">
              Bezpečné přihlášení
            </h3>
            <p className="text-text-secondary leading-relaxed">
              Vaše data jsou chráněna pomocí moderních bezpečnostních standardů
            </p>
          </div>

          <div className="bg-surface border border-border p-8 rounded-xl hover:border-border-light transition-all duration-300 hover:shadow-xl hover:shadow-secondary/5 group">
            <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-secondary/20 transition-colors">
              <svg
                className="w-6 h-6 text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-text-primary">
              Jednoduché používání
            </h3>
            <p className="text-text-secondary leading-relaxed">
              Intuitivní rozhraní pro snadnou správu vašeho účtu
            </p>
          </div>

          <div className="bg-surface border border-border p-8 rounded-xl hover:border-border-light transition-all duration-300 hover:shadow-xl hover:shadow-accent/5 group">
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
              <svg
                className="w-6 h-6 text-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-text-primary">
              Vždy dostupné
            </h3>
            <p className="text-text-secondary leading-relaxed">
              Přístup k aplikaci odkudkoliv a kdykoliv
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
