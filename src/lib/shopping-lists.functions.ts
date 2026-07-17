import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listShoppingLists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("shopping_lists")
      .select("id, name, created_at, user_id, list_items(count)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createShoppingList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ name: z.string().trim().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("shopping_lists")
      .insert({ name: data.name, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteShoppingList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("shopping_lists").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type PriceReportRow = {
  id: string;
  market_id: string;
  product_key: string;
  product_name: string;
  brand: string | null;
  price: number;
  unit: string;
  created_at: string;
};

export const getListDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const [{ data: l, error: lErr }, { data: it, error: itErr }, { data: mk, error: mkErr }] =
      await Promise.all([
        context.supabase
          .from("shopping_lists")
          .select("id,name,user_id")
          .eq("id", data.id)
          .maybeSingle(),
        context.supabase.from("list_items").select("*").eq("list_id", data.id).order("created_at"),
        context.supabase
          .from("markets")
          .select("id,name,chain,color,latitude,longitude")
          .order("name"),
      ]);
    if (lErr) throw new Error(lErr.message);
    if (itErr) throw new Error(itErr.message);
    if (mkErr) throw new Error(mkErr.message);

    let prices: PriceReportRow[] = [];
    if (it && it.length > 0) {
      const keys = Array.from(new Set(it.map((i: { product_key: string }) => i.product_key)));
      const { data: pr, error: prErr } = await context.supabase
        .from("price_reports")
        .select("id,market_id,product_key,product_name,brand,price,unit,created_at")
        .in("product_key", keys)
        .order("created_at", { ascending: false });
      if (prErr) throw new Error(prErr.message);
      prices = (pr ?? []) as PriceReportRow[];
    }

    return { list: l ?? null, items: it ?? [], markets: mk ?? [], prices };
  });

const catalogPickSchema = z.object({
  product_name: z.string().min(1),
  product_key: z.string().min(1),
  category: z.string(),
  unit: z.string(),
  quantity: z.number(),
});

export const addItemsToList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ listId: z.string().uuid(), picks: z.array(catalogPickSchema) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: existingItems, error: existingErr } = await context.supabase
      .from("list_items")
      .select("id,product_key,quantity")
      .eq("list_id", data.listId);
    if (existingErr) throw new Error(existingErr.message);

    const existingByKey = new Map(
      (existingItems ?? []).map((i: { id: string; product_key: string; quantity: number }) => [
        i.product_key,
        i,
      ]),
    );
    const toInsert: typeof data.picks = [];
    const toUpdate: { id: string; quantity: number }[] = [];
    for (const p of data.picks) {
      const existing = existingByKey.get(p.product_key);
      if (existing) {
        toUpdate.push({ id: existing.id, quantity: existing.quantity + p.quantity });
      } else {
        toInsert.push(p);
      }
    }

    if (toInsert.length > 0) {
      const rows = toInsert.map((p) => ({
        list_id: data.listId,
        product_name: p.product_name,
        product_key: p.product_key,
        quantity: p.quantity,
        category: p.category,
        unit: p.unit,
      }));
      const { error } = await context.supabase.from("list_items").insert(rows);
      if (error) throw new Error(error.message);
    }
    for (const u of toUpdate) {
      const { error } = await context.supabase
        .from("list_items")
        .update({ quantity: u.quantity })
        .eq("id", u.id);
      if (error) throw new Error(error.message);
    }

    return { insertedCount: toInsert.length, updatedCount: toUpdate.length };
  });

export const removeListItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ itemId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("list_items").delete().eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateListItemQuantity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ itemId: z.string().uuid(), quantity: z.number().int().min(1) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("list_items")
      .update({ quantity: data.quantity })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
