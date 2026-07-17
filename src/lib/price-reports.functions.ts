import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMarketsForReporting = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("markets")
      .select("id,name,color,chain,city,state,latitude,longitude")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listBrands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("brands")
      .select("id,name,normalized_name,category")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listProductBrandLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("product_brands")
      .select("product_key,brand_id");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const createPriceReportSchema = z.object({
  market_id: z.string().uuid(),
  product_name: z.string().min(1),
  product_key: z.string().min(1),
  brand_id: z.string().uuid(),
  brand: z.string(),
  price: z.number(),
  unit: z.string(),
  category: z.string(),
  photo_url: z.string().nullable(),
});

export const createPriceReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createPriceReportSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("price_reports").insert({
      ...data,
      reporter_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
