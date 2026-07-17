import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut, Camera, Store, ListChecks, Shield, LifeBuoy, Megaphone, Menu, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { checkIsStaff } from "@/lib/admin.functions";

export function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const checkFn = useServerFn(checkIsStaff);
  const { data: staff } = useQuery({
    queryKey: ["is-staff"],
    queryFn: () => checkFn({}),
    enabled: !!user,
  });
  const isStaff = staff?.isAdmin || staff?.isModerator;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Dona Marisa Logo"
              className="h-9 w-9 rounded-xl object-cover shadow-soft"
            />
            <span className="font-display text-lg font-bold tracking-tight">Dona Marisa</span>
          </Link>

          {user ? (
            <nav className="flex items-center gap-1">
              <Link
                to="/lists"
                className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground sm:flex"
                activeProps={{ className: "bg-accent text-foreground" }}
              >
                <ListChecks className="h-4 w-4" /> Minhas listas
              </Link>
              <Link
                to="/markets"
                className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground sm:flex"
                activeProps={{ className: "bg-accent text-foreground" }}
              >
                <Store className="h-4 w-4" /> Mercados
              </Link>
              {isStaff && (
                <Link
                  to="/admin"
                  className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground sm:flex"
                  activeProps={{ className: "bg-accent text-foreground" }}
                >
                  <Shield className="h-4 w-4" /> {staff?.isAdmin ? "Admin" : "Moderação"}
                </Link>
              )}
              <Link
                to="/support"
                className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground sm:flex"
                activeProps={{ className: "bg-accent text-foreground" }}
              >
                <LifeBuoy className="h-4 w-4" /> Suporte
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 hidden rounded-full sm:inline-flex"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
              {/* Mobile menu toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full sm:hidden"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Menu"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </nav>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/auth"
                className="rounded-full px-4 py-1.5 text-sm font-semibold text-foreground hover:bg-accent"
              >
                Entrar
              </Link>
            </div>
          )}
        </div>
        {/* Mobile menu panel */}
        {user && mobileOpen && (
          <div className="border-t border-border/60 bg-background/95 backdrop-blur-xl sm:hidden">
            <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
              <Link
                to="/lists"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                activeProps={{ className: "bg-accent" }}
              >
                <ListChecks className="h-4 w-4" /> Minhas listas
              </Link>
              <Link
                to="/markets"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                activeProps={{ className: "bg-accent" }}
              >
                <Store className="h-4 w-4" /> Mercados
              </Link>
              {isStaff && (
                <Link
                  to="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                  activeProps={{ className: "bg-accent" }}
                >
                  <Shield className="h-4 w-4" /> {staff?.isAdmin ? "Admin" : "Moderação"}
                </Link>
              )}
              <Link
                to="/support"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                activeProps={{ className: "bg-accent" }}
              >
                <LifeBuoy className="h-4 w-4" /> Suporte
              </Link>
              <button
                type="button"
                onClick={async () => {
                  setMobileOpen(false);
                  await signOut();
                  navigate({ to: "/" });
                }}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </nav>
          </div>
        )}
      </header>

      {user && (
        <div className="sticky top-16 z-30 border-b border-coral/20 bg-coral/10 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-coral" />
              <span className="text-sm font-medium text-coral-foreground">
                Encontrou um preço? Contribua com a comunidade!
              </span>
            </div>
            <Link
              to="/report"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-coral px-4 py-2 text-sm font-bold text-coral-foreground shadow-soft transition hover:opacity-90"
            >
              <Camera className="h-4 w-4" /> Reportar preço
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
