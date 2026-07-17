export type CmpItem = { id: string; product_name: string; product_key: string; quantity: number };
export type CmpMarket = { id: string; name: string };
export type CmpPriceReport = {
  id: string;
  market_id: string;
  product_key: string;
  price: number;
  created_at: string;
};

export function computeComparison(
  items: CmpItem[],
  markets: CmpMarket[],
  prices: CmpPriceReport[],
  freight: Record<string, number>,
) {
  const freshest = new Map<string, CmpPriceReport>();
  for (const p of prices) {
    const k = `${p.product_key}|${p.market_id}`;
    if (!freshest.has(k)) freshest.set(k, p);
  }
  const marketBest: Record<string, Record<string, { price: number; report: CmpPriceReport } | null>> = {};
  for (const item of items) {
    const row: Record<string, { price: number; report: CmpPriceReport } | null> = {};
    for (const m of markets) {
      const p = freshest.get(`${item.product_key}|${m.id}`);
      row[m.id] = p ? { price: p.price, report: p } : null;
    }
    marketBest[item.id] = row;
  }

  const itemBest: Record<string, { marketId: string; price: number } | null> = {};
  for (const item of items) {
    let best: { marketId: string; price: number } | null = null;
    for (const m of markets) {
      const r = marketBest[item.id][m.id];
      if (r && (!best || r.price < best.price)) best = { marketId: m.id, price: r.price };
    }
    itemBest[item.id] = best;
  }

  const itemSavings: Record<string, number> = {};
  for (const item of items) {
    const best = itemBest[item.id];
    if (!best) {
      itemSavings[item.id] = 0;
      continue;
    }
    // Restrict to selected markets only — so "max" reflects the filtered comparison.
    const itemPrices = markets
      .map((m) => marketBest[item.id][m.id])
      .filter((r): r is { price: number; report: CmpPriceReport } => !!r);
    const maxPrice = itemPrices.length > 0 ? Math.max(...itemPrices.map((p) => p.price)) : best.price;
    itemSavings[item.id] = Math.max(0, (maxPrice - best.price) * item.quantity);
  }

  const split: Record<string, { items: { item: CmpItem; price: number }[]; subtotal: number }> = {};
  for (const m of markets) split[m.id] = { items: [], subtotal: 0 };
  let optimizedTotal = 0;
  let totalMatched = 0;
  for (const item of items) {
    const best = itemBest[item.id];
    if (best) {
      split[best.marketId].items.push({ item, price: best.price });
      split[best.marketId].subtotal += best.price * item.quantity;
      optimizedTotal += best.price * item.quantity;
      totalMatched += 1;
    }
  }

  const singleMarketTotals = markets.map((m) => {
    let sub = 0;
    let covered = 0;
    for (const item of items) {
      const r = marketBest[item.id][m.id];
      if (r) {
        sub += r.price * item.quantity;
        covered += 1;
      }
    }
    return { market: m, subtotal: sub, covered };
  });

  const splitWithFreight = Object.entries(split)
    .filter(([, v]) => v.items.length > 0)
    .map(([marketId, v]) => ({
      market: markets.find((m) => m.id === marketId)!,
      ...v,
      freight: freight[marketId] || 0,
      total: v.subtotal + (freight[marketId] || 0),
    }))
    .sort((a, b) => b.subtotal - a.subtotal);

  const optimizedFreightTotal = splitWithFreight.reduce((s, x) => s + x.freight, 0);
  const optimizedGrandTotal = optimizedTotal + optimizedFreightTotal;

  const bestSingle = singleMarketTotals
    .filter((s) => s.covered > 0)
    .map((s) => ({ ...s, freight: freight[s.market.id] || 0, total: s.subtotal + (freight[s.market.id] || 0) }))
    .sort((a, b) => a.total - b.total)[0];

  const savedVsBestSingle = bestSingle ? bestSingle.total - optimizedGrandTotal : 0;

  return {
    marketBest,
    itemBest,
    itemSavings,
    splitWithFreight,
    optimizedTotal,
    optimizedFreightTotal,
    optimizedGrandTotal,
    bestSingle,
    savedVsBestSingle,
    totalMatched,
    totalItems: items.length,
  };
}
