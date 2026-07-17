import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatBRL } from "@/lib/utils";

type Item = { id: string; product_name: string; quantity: number };
type Market = { id: string; name: string };

export type ExportData = {
  listName: string;
  markets: Market[];
  items: Item[];
  /** marketBest[itemId][marketId] = price or null */
  marketBest: Record<string, Record<string, { price: number } | null>>;
  /** best market chosen for each item */
  itemBest: Record<string, { marketId: string; price: number } | null>;
  /** itemSavings[itemId] = economy vs worst available price (already multiplied by qty) */
  itemSavings: Record<string, number>;
  splitWithFreight: {
    market: Market;
    items: { item: Item; price: number }[];
    subtotal: number;
    freight: number;
    total: number;
  }[];
  optimizedTotal: number;
  optimizedFreightTotal: number;
  optimizedGrandTotal: number;
  bestSingle: { market: Market; subtotal: number; freight: number; total: number } | null;
  savedVsBestSingle: number;
};

export function exportListPdf(data: ExportData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`Lista de compras — ${data.listName}`, marginX, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    marginX,
    y,
  );
  doc.setTextColor(0);
  y += 18;

  // Resumo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Resumo da economia", marginX, y);
  y += 6;

  const totalSavings = Object.values(data.itemSavings).reduce((s, v) => s + v, 0);
  const summaryRows: [string, string][] = [
    ["Plano otimizado (itens)", formatBRL(data.optimizedTotal)],
    ["Frete total (otimizado)", formatBRL(data.optimizedFreightTotal)],
    ["Total otimizado (com frete)", formatBRL(data.optimizedGrandTotal)],
  ];
  if (data.bestSingle) {
    summaryRows.push([
      `Melhor mercado único (${data.bestSingle.market.name})`,
      `${formatBRL(data.bestSingle.subtotal)} + frete ${formatBRL(data.bestSingle.freight)} = ${formatBRL(data.bestSingle.total)}`,
    ]);
    summaryRows.push([
      "Economia vs. mercado único (com frete)",
      formatBRL(Math.max(0, data.savedVsBestSingle)),
    ]);
  }
  summaryRows.push(["Economia somada por item", formatBRL(totalSavings)]);

  autoTable(doc, {
    startY: y + 4,
    margin: { left: marginX, right: marginX },
    head: [["Indicador", "Valor"]],
    body: summaryRows,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [108, 92, 231] },
    columnStyles: { 1: { halign: "right" } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;

  // Comparativo por item x mercado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Preços por mercado e economia por item", marginX, y);

  const head = [
    "Item",
    "Qtd",
    ...data.markets.map((m) => m.name),
    "Melhor",
    "Economia",
  ];
  const body = data.items.map((item) => {
    const best = data.itemBest[item.id];
    const bestMarket = best ? data.markets.find((m) => m.id === best.marketId) : null;
    const cells = data.markets.map((m) => {
      const r = data.marketBest[item.id]?.[m.id];
      if (!r) return "—";
      const isBest = best && best.marketId === m.id;
      return `${isBest ? "★ " : ""}${formatBRL(r.price)}`;
    });
    const savings = data.itemSavings[item.id] ?? 0;
    return [
      item.product_name,
      String(item.quantity),
      ...cells,
      bestMarket ? `${bestMarket.name}\n${formatBRL(best!.price)}` : "—",
      savings > 0 ? formatBRL(savings) : "—",
    ];
  });

  autoTable(doc, {
    startY: y + 6,
    margin: { left: marginX, right: marginX },
    head: [head],
    body,
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [108, 92, 231], fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { halign: "center", cellWidth: 28 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === head.length - 1) {
        hookData.cell.styles.textColor = [22, 163, 74];
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;

  // Split por mercado
  if (data.splitWithFreight.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      y = 48;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Lista dividida pelos mercados", marginX, y);
    y += 6;

    for (const seg of data.splitWithFreight) {
      autoTable(doc, {
        startY: y + 6,
        margin: { left: marginX, right: marginX },
        head: [[`${seg.market.name}`, "Qtd", "Total"]],
        body: [
          ...seg.items.map(({ item, price }) => [
            item.product_name,
            String(item.quantity),
            formatBRL(price * item.quantity),
          ]),
          ["Frete", "", formatBRL(seg.freight)],
          [
            { content: "Total do mercado", styles: { fontStyle: "bold" } },
            "",
            { content: formatBRL(seg.total), styles: { fontStyle: "bold" } },
          ],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [40, 40, 40] },
        columnStyles: {
          1: { halign: "center", cellWidth: 40 },
          2: { halign: "right", cellWidth: 80 },
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    }
  }

  // Rodapé com totais
  if (y > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage();
    y = 48;
  }
  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Total otimizado com frete: ${formatBRL(data.optimizedGrandTotal)}`, marginX, y);
  y += 16;
  doc.setTextColor(22, 163, 74);
  doc.text(
    `Economia total estimada: ${formatBRL(Math.max(totalSavings, data.savedVsBestSingle))}`,
    marginX,
    y,
  );
  doc.setTextColor(0);

  const filename = `lista-${data.listName.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.pdf`;
  doc.save(filename);
}
