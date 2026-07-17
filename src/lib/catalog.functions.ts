import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeProductKey } from "@/lib/utils";

export const listProductCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("product_catalog")
      .select("id, product_key, name, category, unit")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const requestBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().trim().min(1),
        suggestedCategory: z.string().nullable(),
        productKey: z.string().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("brand_requests").insert({
      name: data.name,
      normalized_name: normalizeProductKey(data.name),
      suggested_category: data.suggestedCategory,
      product_key: data.productKey,
      requested_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
