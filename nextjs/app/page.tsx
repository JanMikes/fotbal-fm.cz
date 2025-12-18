"use client";

import Link from "next/link";
import Image from "next/image";
import Button from "@/components/ui/Button";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function Home() {
  const { user, loading } = useRequireAuth({
    redirectIfAuthenticated: true,
    authenticatedRedirectTo: "/dashboard",
  });

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Background Image Layer */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/background.png)" }}
      />

      {/* Gradient Overlay - Navy to Cyan */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#031b44]/90 via-[#031b44]/70 to-[#0099d4]/40" />

      {/* Subtle Dot Pattern */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl">
          <Image
            src="/logo.svg"
            alt="Fotbal Frýdek-Místek"
            width={160}
            height={192}
            className="mx-auto mb-6 md:mb-8 w-28 h-auto md:w-40"
            priority
          />
          <h1
            className="text-5xl md:text-7xl font-bold text-white mb-6 md:mb-8"
            style={{ textShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
          >
            Fotbal FM
          </h1>
          <p
            className="text-lg md:text-xl text-white/90 mb-8 md:mb-12 max-w-3xl mx-auto leading-relaxed"
            style={{ textShadow: "0 2px 10px rgba(0,0,0,0.2)" }}
          >
            Aplikace fotbalu-fm je prostor pro snadné a rychlé vytváření
            klubového obsahu. Umožňuje nejen trenérům, ale i vedení přidávat
            výsledky, turnaje, události, statistiky a informace, které chce
            sdílet na webu, sociálních sítích nebo v mobilní aplikaci.
          </p>

          {!loading && !user && (
            <div className="flex justify-center gap-3 md:gap-4 flex-wrap pb-4">
              <Link href="/prihlaseni">
                <Button variant="primary" size="lg" className="backdrop-blur-sm bg-white/10 border border-white/20 hover:bg-white/20">
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
