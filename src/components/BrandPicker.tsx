import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, Search, Tag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { requestBrand } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, CATEGORIES } from "@/lib/utils";

export type Brand = { id: string; name: string; normalized_name: string; category: string | null };

type Props = {
  value: Brand | null;
  onChange: (b: Brand | null) => void;
  brands: Brand[];
  productKey?: string | null;
  productCategory?: string | null;
  onRequestCreated?: () => void;
};

export function BrandPicker({ value, onChange, brands, productKey, productCategory, onRequestCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestCategory, setRequestCategory] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const requestBrandFn = useServerFn(requestBrand);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return brands;
    const tokens = q.split(/\s+/);
    return brands.filter((b) => tokens.every((t) => b.name.toLowerCase().includes(t)));
  }, [brands, search]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const openRequest = () => {
    setRequestName(search.trim() || "");
    setRequestCategory(productCategory ?? "");
    setOpen(false);
    setRequestOpen(true);
  };

  const submitRequest = async () => {
    const name = requestName.trim();
    if (!name) {
      toast.error("Informe o nome da marca");
      return;
    }
    setSubmitting(true);
    try {
      await requestBrandFn({
        data: {
          name,
          suggestedCategory: requestCategory || null,
          productKey: productKey ?? null,
        },
      });
      toast.success("Solicitação enviada! Um moderador irá revisar.");
      setRequestOpen(false);
      setRequestName("");
      setRequestCategory("");
      onRequestCreated?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar solicitação");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="mt-1.5 h-10 w-full justify-between font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Tag className="h-3.5 w-3.5 shrink-0 opacity-60" />
              {value ? (
                <span className="truncate">{value.name}</span>
              ) : (
                <span className="text-muted-foreground">Selecione a marca…</span>
              )}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar marca…"
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
                <Tag className="h-5 w-5 opacity-50" />
                Nenhuma marca encontrada
              </div>
            ) : (
              filtered.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    onChange(b);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                    value?.id === b.id && "bg-accent/50",
                  )}
                >
                  <Check className={cn("h-4 w-4", value?.id === b.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{b.name}</span>
                  {b.category && (
                    <span className="text-xs text-muted-foreground">{b.category}</span>
                  )}
                </button>
              ))
            )}
          </div>
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={openRequest}
            >
              <Plus className="mr-2 h-4 w-4" />
              Não encontrei {search.trim() ? `"${search.trim()}"` : "minha marca"} — solicitar cadastro
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar nova marca</DialogTitle>
            <DialogDescription>
              Um moderador irá revisar e aprovar. Depois você poderá selecioná-la no seletor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="req-name">Nome da marca</Label>
              <Input
                id="req-name"
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
                placeholder="Ex: Marca Local"
                className="mt-1.5"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="req-cat">Categoria sugerida (opcional)</Label>
              <select
                id="req-cat"
                value={requestCategory}
                onChange={(e) => setRequestCategory(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {CATEGORIES.filter((c) => c.value !== "outros").map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRequestOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={submitRequest} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
              Enviar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
