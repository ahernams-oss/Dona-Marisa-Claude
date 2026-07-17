import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isAdmin(userId: string, supabaseClient?: any): Promise<boolean> {
  try {
    const client = supabaseClient || (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data, error } = await client
      .from("user_roles")
      .select("user_id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return !!data;
  } catch (err) {
    console.error("Error in isAdmin:", err);
    return false;
  }
}

async function isStaff(userId: string, supabaseClient?: any): Promise<{ isAdmin: boolean; isModerator: boolean }> {
  try {
    const client = supabaseClient || (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data, error } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r: any) => r.role as string);
    return { isAdmin: roles.includes("admin"), isModerator: roles.includes("moderator") };
  } catch (err) {
    console.error("Error in isStaff:", err);
    return { isAdmin: false, isModerator: false };
  }
}

async function assertAdmin(supabase: any, userId: string) {
  if (!(await isAdmin(userId, supabase))) throw new Response("Forbidden", { status: 403 });
}

async function assertStaff(supabase: any, userId: string) {
  const { isAdmin: a, isModerator: m } = await isStaff(userId, supabase);
  if (!a && !m) throw new Response("Forbidden", { status: 403 });
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return { isAdmin: await isAdmin(context.userId, context.supabase) };
  });

export const checkIsStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await isStaff(context.userId, context.supabase);
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (authErr) throw new Error(authErr.message);

    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rolesErr) throw new Error(rolesErr.message);

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, city");

    const rolesByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return authData.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      full_name: (profileById.get(u.id) as any)?.full_name ?? null,
      city: (profileById.get(u.id) as any)?.city ?? null,
      roles: rolesByUser.get(u.id) ?? [],
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "moderator", "user"]),
        grant: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && data.role === "admin" && !data.grant) {
      throw new Response("Você não pode remover seu próprio acesso de admin", { status: 400 });
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listPricesByMarket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: markets, error: mErr } = await supabaseAdmin
      .from("markets")
      .select("id, name, city, state, neighborhood, address")
      .order("name");
    if (mErr) throw new Error(mErr.message);

    const { data: prices, error: pErr } = await supabaseAdmin
      .from("price_reports")
      .select(
        "id, market_id, reporter_id, product_name, brand, price, unit, category, photo_url, created_at",
      )
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);

    const reporterIds = Array.from(new Set((prices ?? []).map((p: any) => p.reporter_id)));
    const { data: profiles } = reporterIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", reporterIds)
      : { data: [] as any[] };
    const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

    const byMarket = new Map<string, any[]>();
    (prices ?? []).forEach((p: any) => {
      const arr = byMarket.get(p.market_id) ?? [];
      arr.push({ ...p, reporter_name: nameById.get(p.reporter_id) ?? null });
      byMarket.set(p.market_id, arr);
    });

    return (markets ?? []).map((m: any) => ({
      ...m,
      prices: byMarket.get(m.id) ?? [],
    }));
  });

/**
 * Aggregate every distinct product_key that appears in price_reports or
 * list_items, with usage counts and whether it exists in the catalog.
 * Used by admin to identify divergent entries (e.g. "arroz-5kg" vs
 * "arroz-5kg-tio-joao") and merge them.
 */
export const listProductKeysUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: reports, error: rErr }, { data: items, error: iErr }, { data: catalog, error: cErr }] =
      await Promise.all([
        supabaseAdmin.from("price_reports").select("product_key, product_name, category, unit"),
        supabaseAdmin.from("list_items").select("product_key, product_name, category, unit"),
        supabaseAdmin.from("product_catalog").select("id, product_key, name, category, unit").order("name"),
      ]);
    if (rErr) throw new Error(rErr.message);
    if (iErr) throw new Error(iErr.message);
    if (cErr) throw new Error(cErr.message);

    const catalogKeys = new Set((catalog ?? []).map((c: any) => c.product_key));
    type Row = {
      product_key: string;
      sample_name: string;
      category: string | null;
      unit: string | null;
      reports: number;
      list_items: number;
      in_catalog: boolean;
    };
    const map = new Map<string, Row>();
    const bump = (key: string, name: string, cat: string | null, unit: string | null, kind: "r" | "i") => {
      const cur = map.get(key) ?? {
        product_key: key,
        sample_name: name,
        category: cat,
        unit,
        reports: 0,
        list_items: 0,
        in_catalog: catalogKeys.has(key),
      };
      if (kind === "r") cur.reports += 1;
      else cur.list_items += 1;
      map.set(key, cur);
    };
    (reports ?? []).forEach((r: any) => bump(r.product_key, r.product_name, r.category, r.unit, "r"));
    (items ?? []).forEach((r: any) => bump(r.product_key, r.product_name, r.category, r.unit, "i"));

    return {
      rows: Array.from(map.values()).sort((a, b) => {
        if (a.in_catalog !== b.in_catalog) return a.in_catalog ? 1 : -1;
        return b.reports + b.list_items - (a.reports + a.list_items);
      }),
      catalog: (catalog ?? []).map((c: any) => ({
        id: c.id,
        product_key: c.product_key,
        name: c.name,
        category: c.category,
        unit: c.unit,
      })),
    };
  });

/**
 * Replace every reference to `from` product_key with the catalog entry
 * identified by `toCatalogId` across price_reports and list_items.
 */
export const mergeProductKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        from: z.string().min(1),
        toCatalogId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target, error: tErr } = await supabaseAdmin
      .from("product_catalog")
      .select("product_key, name, category, unit")
      .eq("id", data.toCatalogId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!target) throw new Response("Produto destino não encontrado", { status: 404 });
    if (target.product_key === data.from) {
      throw new Response("Origem e destino são o mesmo produto", { status: 400 });
    }

    const payload = {
      product_key: target.product_key,
      product_name: target.name,
      category: target.category,
      unit: target.unit,
    };

    const { error: rErr, count: rCount } = await supabaseAdmin
      .from("price_reports")
      .update(payload, { count: "exact" })
      .eq("product_key", data.from);
    if (rErr) throw new Error(rErr.message);

    const { error: iErr, count: iCount } = await supabaseAdmin
      .from("list_items")
      .update(payload, { count: "exact" })
      .eq("product_key", data.from);
    if (iErr) throw new Error(iErr.message);

    return { ok: true, reportsUpdated: rCount ?? 0, itemsUpdated: iCount ?? 0 };
  });

/**
 * Promote an orphan product_key (free-text) to the curated catalog so future
 * reports can pick it up.
 */
export const promoteToCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        product_key: z.string().min(1),
        name: z.string().min(1),
        category: z.string().min(1),
        unit: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("product_catalog").insert({
      product_key: data.product_key,
      name: data.name,
      category: data.category,
      unit: data.unit,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Brand moderation — staff (admin + moderator) can list and review requests,
 * create brands, and edit brands.
 */

function normalizeBrand(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const listBrandRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ status: z.enum(["pending", "approved", "rejected", "all"]).default("pending") })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("brand_requests")
      .select("id, name, normalized_name, suggested_category, requested_by, status, review_notes, reviewed_by, reviewed_at, approved_brand_id, created_at")
      .order("created_at", { ascending: false });
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(
      new Set([
        ...(rows ?? []).map((r: any) => r.requested_by),
        ...(rows ?? []).map((r: any) => r.reviewed_by).filter(Boolean),
      ]),
    );
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] as any[] };
    const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

    return (rows ?? []).map((r: any) => ({
      ...r,
      requested_by_name: nameById.get(r.requested_by) ?? null,
      reviewed_by_name: r.reviewed_by ? nameById.get(r.reviewed_by) ?? null : null,
    }));
  });

export const reviewBrandRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["approve", "reject"]),
        notes: z.string().optional(),
        category_override: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: rErr } = await supabaseAdmin
      .from("brand_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!req) throw new Response("Solicitação não encontrada", { status: 404 });
    if (req.status !== "pending") {
      throw new Response("Solicitação já foi revisada", { status: 400 });
    }

    let approvedBrandId: string | null = null;

    if (data.action === "approve") {
      // Reuse existing brand by normalized name, or create new.
      const normalized = normalizeBrand(req.name);
      const { data: existing } = await supabaseAdmin
        .from("brands")
        .select("id")
        .eq("normalized_name", normalized)
        .maybeSingle();
      if (existing) {
        approvedBrandId = existing.id;
      } else {
        const { data: created, error: cErr } = await supabaseAdmin
          .from("brands")
          .insert({
            name: req.name,
            normalized_name: normalized,
            category: data.category_override ?? req.suggested_category ?? null,
            created_by: req.requested_by,
          })
          .select("id")
          .single();
        if (cErr) throw new Error(cErr.message);
        approvedBrandId = created.id;
      }

      // Auto-link approved brand to the product the user was reporting, if any.
      if (approvedBrandId && req.product_key) {
        await supabaseAdmin
          .from("product_brands")
          .upsert(
            { product_key: req.product_key, brand_id: approvedBrandId, created_by: context.userId },
            { onConflict: "product_key,brand_id" },
          );
      }
    }

    const { error: uErr } = await supabaseAdmin
      .from("brand_requests")
      .update({
        status: data.action === "approve" ? "approved" : "rejected",
        review_notes: data.notes ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        approved_brand_id: approvedBrandId,
      })
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);

    return { ok: true, approvedBrandId };
  });

export const createBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().min(1),
        category: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalized = normalizeBrand(data.name);
    const { data: created, error } = await supabaseAdmin
      .from("brands")
      .insert({
        name: data.name,
        normalized_name: normalized,
        category: data.category ?? null,
        created_by: context.userId,
      })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

/**
 * Product ↔ Brand associations (staff only).
 */
export const listProductBrandAssociations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ product_key: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("product_brands")
      .select("brand_id, brands ( id, name, normalized_name, category )")
      .eq("product_key", data.product_key);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => r.brands).filter(Boolean);
  });

export const setProductBrandAssociations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        product_key: z.string().min(1),
        brand_ids: z.array(z.string().uuid()),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Replace the set: delete current and insert new.
    const { error: dErr } = await supabaseAdmin
      .from("product_brands")
      .delete()
      .eq("product_key", data.product_key);
    if (dErr) throw new Error(dErr.message);

    if (data.brand_ids.length > 0) {
      const rows = data.brand_ids.map((brand_id) => ({
        product_key: data.product_key,
        brand_id,
        created_by: context.userId,
      }));
      const { error: iErr } = await supabaseAdmin.from("product_brands").insert(rows);
      if (iErr) throw new Error(iErr.message);
    }
    return { ok: true, count: data.brand_ids.length };
  });

export const listAllBrands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("brands")
      .select("id, name, normalized_name, category")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

