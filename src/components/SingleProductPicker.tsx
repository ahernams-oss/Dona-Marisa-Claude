import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Check, X, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CATEGORIES, getCategory, normalizeProductKey } from "@/lib/utils";

export type CatalogProduct = {
  id: string;
  product_key: string;
  name: string;
  category: string;
  unit: string;
};

type Props = {
  value: CatalogProduct | null;
  onChange: (p: CatalogProduct | null) => void;
  /** initial search seed (e.g. coming from AI extraction) */
  seed?: string;
};

/**
 * Single-selection product picker bound to the curated catalog.
 * Forces consistent product_key / product_name / category / unit across reports
 * to avoid divergence (e.g. "Arroz 5kg" vs "Arroz 5kg Tio João").
 */
export function SingleProductPicker({ value, onChange, seed }: Props) {
  const [all, setAll] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const seededRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("product_catalog")
        .select("id, product_key, name, category, unit")
        .order("name");
      if (!cancelled) {
        setAll((data ?? []) as CatalogProduct[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When AI seeds a new name, try to auto-select an exact match; otherwise
  // pre-fill the search to surface suggestions.
  useEffect(() => {
    if (!seed || all.length === 0 || seededRef.current === seed) return;
    seededRef.current = seed;
    const key = normalizeProductKey(seed);
    const exact = all.find((p) => p.product_key === key);
    if (exact) {
      onChange(exact);
      setQuery("");
    } else {
      setQuery(seed);
      setPopoverOpen(true);
    }
  }, [seed, all, onChange]);

  const suggestions = useMemo(() => {
    const q = normalizeProductKey(query);
    if (!q) return [];
    return all
      .filter((p) => normalizeProductKey(p.name).includes(q))
      .slice(0, 8);
  }, [query, all]);

  const pick = (p: CatalogProduct) => {
    onChange(p);
    setQuery("");
    setPopoverOpen(false);
    setModalOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
    inputRef.current?.focus();
  };

  if (value) {
    const cat = getCategory(value.category);
    return (
      <div className="mt-1.5 flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-base">
            {cat.emoji}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{value.name}</p>
            <p className="text-xs text-muted-foreground">
              {cat.label} · {value.unit}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={clear}
          className="shrink-0 text-muted-foreground"
        >
          <X className="mr-1 h-3.5 w-3.5" /> Trocar
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-soft">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPopoverOpen(true);
            }}
            onFocus={() => setPopoverOpen(true)}
            onBlur={() => setTimeout(() => setPopoverOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && suggestions[0]) {
                e.preventDefault();
                pick(suggestions[0]);
              }
              if (e.key === "Escape") setPopoverOpen(false);
            }}
            placeholder={loading ? "Carregando catálogo…" : "Busque o produto (ex: arroz 5kg)"}
            className="border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
            aria-label="Buscar produto no catálogo"
          />
          {popoverOpen && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
              {suggestions.map((p) => {
                const cat = getCategory(p.category);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(p)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden>{cat.emoji}</span>
                      <span className="truncate font-medium">{p.name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{p.unit}</span>
                  </button>
                );
              })}
            </div>
          )}
          {popoverOpen && query.trim() && suggestions.length === 0 && !loading && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-border bg-popover p-3 text-xs text-muted-foreground shadow-lg">
              Nenhum item do catálogo combina com "{query.trim()}". Peça ao admin para cadastrar.
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setModalOpen(true)}
          className="rounded-full"
        >
          <Package className="mr-1 h-4 w-4" />
          Catálogo
        </Button>
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        Só é possível reportar produtos do catálogo — isso garante que o mesmo item de mercados diferentes seja comparado corretamente.
      </p>

      <CatalogBrowse
        open={modalOpen}
        onOpenChange={setModalOpen}
        products={all}
        onPick={pick}
      />
    </>
  );
}

function CatalogBrowse({
  open,
  onOpenChange,
  products,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: CatalogProduct[];
  onPick: (p: CatalogProduct) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    if (open) {
      setSearch("");
      setActiveCategory("all");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = normalizeProductKey(search);
    return products.filter((p) => {
      if (activeCategory !== "all" && p.category !== activeCategory) return false;
      if (!q) return true;
      return normalizeProductKey(p.name).includes(q);
    });
  }, [products, search, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogProduct[]>();
    for (const p of filtered) {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    }
    return Array.from(map.entries())
      .map(([cat, items]) => ({ category: getCategory(cat), items }))
      .sort((a, b) => a.category.order - b.category.order);
  }, [filtered]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-5">
          <DialogTitle>Escolher produto do catálogo</DialogTitle>
          <DialogDescription>Selecione um item para reportar o preço.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border-b border-border p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto…"
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="Todas"
              emoji="🛒"
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
            />
            {CATEGORIES.map((c) => (
              <Chip
                key={c.value}
                label={c.label}
                emoji={c.emoji}
                active={activeCategory === c.value}
                onClick={() => setActiveCategory(c.value)}
              />
            ))}
          </div>
        </div>

        <div className="max-h-[55vh] overflow-auto p-4">
          {grouped.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado.
            </p>
          ) : (
            grouped.map(({ category, items }) => (
              <section key={category.value} className="mb-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span aria-hidden>{category.emoji}</span> {category.label}
                  <span className="font-normal normal-case text-muted-foreground/70">
                    · {items.length}
                  </span>
                </h3>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {items.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onPick(p)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span className="min-w-0 truncate font-medium">{p.name}</span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{p.unit}</span>
                          <Check className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 p-3">
          <span className="text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "produto" : "produtos"}
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="mr-1 h-4 w-4" /> Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Chip({
  label,
  emoji,
  active,
  onClick,
}: {
  label: string;
  emoji: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <span aria-hidden>{emoji}</span>
      {label}
    </button>
  );
}

