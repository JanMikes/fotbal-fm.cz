"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { useUser } from "@/contexts/UserContext";
import PixelFootballPlayer from "@/components/PixelFootballPlayer";

export default function Home() {
  const { user, loading } = useUser();

  return (
    <div className="bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <h1 className="text-5xl md:text-6xl font-bold text-text-primary mb-6 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Vítejte ve Fotbal FM
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

        {/* Pixel Football Player Animation */}
        <PixelFootballPlayer />
      </div>
    </div>
  );
}
