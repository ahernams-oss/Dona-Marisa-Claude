import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { exportListPdf } from "@/lib/export-pdf";
import { computeComparison, type CmpItem, type CmpMarket, type CmpPriceReport } from "@/lib/comparison";

type Props = {
  listName: string;
  items: CmpItem[];
  markets: (CmpMarket & { color?: string | null })[];
  prices: CmpPriceReport[];
  freight: Record<string, number>;
  disabled?: boolean;
};

export function ExportPdfDialog({ listName, items, markets, prices, freight, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(markets.map((m) => m.id)));

  // Re-sync when markets change between opens
  const handleOpenChange = (next: boolean) => {
    if (next) setSelected(new Set(markets.map((m) => m.id)));
    setOpen(next);
  };

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleExport = () => {
    const filteredMarkets = markets.filter((m) => selected.has(m.id));
    const cmp = computeComparison(items, filteredMarkets, prices, freight);
    exportListPdf({
      listName,
      markets: filteredMarkets,
      items,
      marketBest: cmp.marketBest,
      itemBest: cmp.itemBest,
      itemSavings: cmp.itemSavings,
      splitWithFreight: cmp.splitWithFreight,
      optimizedTotal: cmp.optimizedTotal,
      optimizedFreightTotal: cmp.optimizedFreightTotal,
      optimizedGrandTotal: cmp.optimizedGrandTotal,
      bestSingle: cmp.bestSingle ?? null,
      savedVsBestSingle: cmp.savedVsBestSingle,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full" disabled={disabled}>
          <FileDown className="mr-1.5 h-4 w-4" /> Exportar PDF
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar PDF</DialogTitle>
          <DialogDescription>Selecione os mercados que devem entrar na comparação.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          <div className="flex items-center justify-between pb-2">
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setSelected(new Set(markets.map((m) => m.id)))}>
              Selecionar todos
            </button>
            <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setSelected(new Set())}>
              Limpar
            </button>
          </div>
          {markets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum mercado cadastrado.</p>
          ) : (
            markets.map((m) => (
              <label key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 cursor-pointer hover:bg-accent/30">
                <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggle(m.id)} />
                <span className="h-3 w-3 rounded-full" style={{ background: m.color ?? "#6C5CE7" }} />
                <span className="text-sm font-medium">{m.name}</span>
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleExport} disabled={selected.size === 0}>
            <FileDown className="mr-1.5 h-4 w-4" /> Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
