import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const marketPayloadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  chain: z.string().trim().max(80).nullable(),
  state: z.string().nullable(),
  city: z.string().nullable(),
  color: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  postal_code: z.string().nullable(),
  address: z.string().nullable(),
  number: z.string().nullable(),
  neighborhood: z.string().nullable(),
});

export const listMarkets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("markets").select("*").order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listRecentPriceReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("price_reports")
      .select("market_id,price,product_name,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => marketPayloadSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("markets").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), payload: marketPayloadSchema }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("markets").update(data.payload).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("markets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
