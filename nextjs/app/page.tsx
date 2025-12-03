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
        <div className="text-center mb-10">
          <h1 className="text-5xl md:text-6xl font-bold text-text-primary mb-6 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Fotbal FM
          </h1>
          <p className="text-xl md:text-2xl text-text-secondary mb-10 max-w-3xl mx-auto">
            Aplikace fotbalu-fm je prostor pro snadné a rychlé vytváření klubového obsahu. Umožňuje nejen trenérům, ale i vedení přidávat výsledky, turnaje, události, statistiky a informace, které chce sdílet na webu, sociálních sítích nebo v mobilní aplikaci. Všechny podklady tím budou přehledně na jednom místě, připravené k dalšímu marketingovému použití.
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

      </div>
    </div>
  );
}
