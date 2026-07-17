import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ListPlus, Check, X, Minus, Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listProductCatalog } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, getCategory, normalizeProductKey } from "@/lib/utils";

export type CatalogProduct = {
  id: string;
  product_key: string;
  name: string;
  category: string;
  unit: string;
};

type AddPayload = {
  product_name: string;
  product_key: string;
  category: string;
  unit: string;
  quantity: number;
};

type Props = {
  onAdd: (items: AddPayload[]) => Promise<void> | void;
  existingKeys?: Set<string>;
};

/**
 * Inline autocomplete + catalog browser modal.
 */
export function CatalogPicker({ onAdd, existingKeys }: Props) {
  const [all, setAll] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listProductCatalogFn = useServerFn(listProductCatalog);

  // Fechar popover ao clicar/tocar fora do container de busca (evita bugs do onBlur no mobile)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await listProductCatalogFn();
      if (!cancelled) {
        setAll(data as CatalogProduct[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Suggestions for inline autocomplete
  const suggestions = useMemo(() => {
    const q = normalizeProductKey(query);
    if (!q) return [];
    return all
      .filter((p) => normalizeProductKey(p.name).includes(q))
      .slice(0, 8);
  }, [query, all]);

  const [inlineQty, setInlineQty] = useState(1);

  const handlePick = async (p: CatalogProduct) => {
    setQuery("");
    setPopoverOpen(false);
    await onAdd([
      {
        product_name: p.name,
        product_key: p.product_key,
        category: p.category,
        unit: p.unit,
        quantity: inlineQty,
      },
    ]);
    setInlineQty(1);
    // Refoca o campo de busca para facilitar a adição contínua de itens no mobile/desktop
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleAddCustom = async () => {
    if (!query.trim()) return;
    const name = query.trim();
    setQuery("");
    setPopoverOpen(false);
    await onAdd([
      {
        product_name: name,
        product_key: normalizeProductKey(name),
        category: "outros",
        unit: "un",
        quantity: inlineQty,
      },
    ]);
    setInlineQty(1);
    // Refoca o campo de busca para facilitar a adição contínua de itens
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft">
        <div ref={containerRef} className="relative w-full sm:min-w-0 sm:flex-1">
          {/* Lupa clicável que dá foco ao input de busca */}
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
            aria-label="Focar campo de busca"
          >
            <Search className="h-4 w-4" />
          </button>
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPopoverOpen(true);
            }}
            onFocus={() => setPopoverOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (suggestions[0]) handlePick(suggestions[0]);
                else handleAddCustom();
              }
              if (e.key === "Escape") setPopoverOpen(false);
            }}
            placeholder={loading ? "Carregando catálogo…" : "Busque um produto (ex: arroz 5kg)"}
            className="border-0 bg-transparent pl-9 pr-9 shadow-none focus-visible:ring-0 w-full"
            aria-label="Buscar produto no catálogo"
          />
          {/* Botão limpar (X) que limpa o input e mantém foco */}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {popoverOpen && (suggestions.length > 0 || query.trim()) && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
              {suggestions.map((p) => {
                const cat = getCategory(p.category);
                const already = existingKeys?.has(p.product_key);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePick(p)}
                    disabled={already}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 sm:py-2.5 text-left text-sm hover:bg-accent disabled:opacity-50 transition-colors duration-150"
                  >
                    <span className="flex min-w-0 items-center gap-2 flex-1">
                      <span aria-hidden>{cat.emoji}</span>
                      <span className="truncate font-medium">{p.name}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                      <span>{p.unit}</span>
                      {already ? <Check className="h-3.5 w-3.5 text-success" /> : null}
                    </span>
                  </button>
                );
              })}
              {suggestions.length === 0 && query.trim() && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleAddCustom}
                  className="flex w-full items-center gap-2 rounded-xl px-4 py-3 sm:py-2.5 text-left text-sm hover:bg-accent text-primary transition-colors duration-150 font-medium"
                >
                  <ListPlus className="h-4 w-4 text-primary" />
                  Adicionar "{query.trim()}" como item livre
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-border/40 pt-2 sm:pt-0">
          <div className="flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-1">
            <button
              type="button"
              onClick={() => setInlineQty((q) => Math.max(1, q - 1))}
              className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Diminuir quantidade"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums">{inlineQty}</span>
            <button
              type="button"
              onClick={() => setInlineQty((q) => q + 1)}
              className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Aumentar quantidade"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(true)}
            className="rounded-full"
          >
            <ListPlus className="mr-1 h-4 w-4" />
            Catálogo
          </Button>
        </div>
      </div>

      <CatalogModal
        open={open}
        onOpenChange={setOpen}
        products={all}
        existingKeys={existingKeys}
        onAdd={onAdd}
      />
    </>
  );
}

function CatalogModal({
  open,
  onOpenChange,
  products,
  existingKeys,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: CatalogProduct[];
  existingKeys?: Set<string>;
  onAdd: (items: AddPayload[]) => Promise<void> | void;
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setQuantities(new Map());
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

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setQuantities((q) => {
          const nq = new Map(q);
          nq.delete(id);
          return nq;
        });
      } else {
        next.add(id);
        setQuantities((q) => {
          const nq = new Map(q);
          nq.set(id, 1);
          return nq;
        });
      }
      return next;
    });
  };

  const setItemQty = (id: string, qty: number) => {
    setQuantities((q) => {
      const nq = new Map(q);
      nq.set(id, Math.max(1, qty));
      return nq;
    });
  };

  const handleConfirm = async () => {
    const picked = products
      .filter((p) => selected.has(p.id))
      .map((p) => ({
        product_name: p.name,
        product_key: p.product_key,
        category: p.category,
        unit: p.unit,
        quantity: quantities.get(p.id) ?? 1,
      }));
    if (picked.length === 0) {
      onOpenChange(false);
      return;
    }
    await onAdd(picked);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-[calc(100vw-1rem)] max-w-3xl flex-col overflow-hidden p-0 sm:h-auto sm:max-h-[85vh]">
        <DialogHeader className="shrink-0 border-b border-border p-5">
          <DialogTitle>Catálogo de produtos</DialogTitle>
          <DialogDescription>
            Selecione um ou mais itens para adicionar à sua lista.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 space-y-3 border-b border-border p-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const input = document.getElementById("modal-search-input");
                input?.focus();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
              aria-label="Focar busca no catálogo"
            >
              <Search className="h-4 w-4" />
            </button>
            <Input
              id="modal-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto…"
              className="pl-9 pr-9"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  document.getElementById("modal-search-input")?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                aria-label="Limpar busca no catálogo"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <CategoryChip
              label="Todas"
              emoji="🛒"
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
            />
            {CATEGORIES.map((c) => (
              <CategoryChip
                key={c.value}
                label={c.label}
                emoji={c.emoji}
                active={activeCategory === c.value}
                onClick={() => setActiveCategory(c.value)}
              />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
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
                  {items.map((p) => {
                    const checked = selected.has(p.id);
                    const already = existingKeys?.has(p.product_key);
                    const qty = quantities.get(p.id) ?? 1;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => !already && toggle(p.id)}
                          disabled={already}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                            checked
                              ? "border-primary bg-primary/10"
                              : "border-border bg-card hover:bg-accent"
                          } ${already ? "opacity-50" : ""}`}
                        >
                          <span className="min-w-0 truncate font-medium">{p.name}</span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            {checked && !already && (
                              <span
                                className="flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => setItemQty(p.id, qty - 1)}
                                  className="rounded p-0.5 hover:bg-accent"
                                  aria-label="Diminuir"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="min-w-[1rem] text-center font-semibold tabular-nums">{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => setItemQty(p.id, qty + 1)}
                                  className="rounded p-0.5 hover:bg-accent"
                                  aria-label="Aumentar"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </span>
                            )}
                            <span>{p.unit}</span>
                            {already ? (
                              <Check className="h-3.5 w-3.5 text-success" />
                            ) : checked ? (
                              <Check className="h-3.5 w-3.5 text-primary" />
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>

        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 p-4">
          <Badge variant="secondary">
            {selected.size} {selected.size === 1 ? "item selecionado" : "itens selecionados"}
          </Badge>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="mr-1 h-4 w-4" /> Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={selected.size === 0}>
              <ListPlus className="mr-1 h-4 w-4" /> Adicionar à lista
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryChip({
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
