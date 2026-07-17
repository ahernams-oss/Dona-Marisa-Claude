import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Share = {
  id: string;
  shared_with_user_id: string;
  created_at: string;
  full_name: string | null;
};

export const listShares = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ listId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<Share[]> => {
    const { data: rows, error } = await context.supabase
      .from("list_shares")
      .select("id, shared_with_user_id, created_at")
      .eq("list_id", data.listId)
      .order("created_at");
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    if (list.length === 0) return list.map((r) => ({ ...r, full_name: null }));

    const ids = list.map((r) => r.shared_with_user_id);
    const { data: profs, error: profErr } = await context.supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    if (profErr) throw new Error(profErr.message);
    const map = new Map(
      (profs ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]),
    );
    return list.map((r) => ({ ...r, full_name: map.get(r.shared_with_user_id) ?? null }));
  });

export const inviteToList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ listId: z.string().uuid(), userId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("list_shares")
      .insert({ list_id: data.listId, shared_with_user_id: data.userId });
    if (error) {
      if (error.code === "23505") {
        return { ok: false, alreadyShared: true };
      }
      throw new Error(error.message);
    }
    return { ok: true, alreadyShared: false };
  });

export const removeShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("list_shares").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
