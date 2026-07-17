import { useEffect, useState } from "react";
import { Loader2, Share2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { findUserIdByEmail } from "@/lib/share.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

type Share = { id: string; shared_with_user_id: string; created_at: string; full_name: string | null };

type Props = { listId: string; isOwner: boolean };

export function ShareListDialog({ listId, isOwner }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const findUser = useServerFn(findUserIdByEmail);

  const load = async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from("list_shares")
      .select("id, shared_with_user_id, created_at")
      .eq("list_id", listId)
      .order("created_at");
    const list = rows ?? [];
    let withNames: Share[] = list.map((r) => ({ ...r, full_name: null }));
    if (list.length > 0) {
      const ids = list.map((r) => r.shared_with_user_id);
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map = new Map((profs ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]));
      withNames = list.map((r) => ({ ...r, full_name: map.get(r.shared_with_user_id) ?? null }));
    }
    setShares(withNames);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listId]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const { userId } = await findUser({ data: { email: email.trim() } });
      if (!userId) {
        toast.error("Nenhuma usuária Dona Marisa com esse e-mail. Peça pra ela criar conta primeiro 💜");
        return;
      }
      const { error } = await supabase.from("list_shares").insert({ list_id: listId, shared_with_user_id: userId });
      if (error) {
        if (error.code === "23505") toast.info("Essa pessoa já tem acesso.");
        else throw error;
      } else {
        toast.success("Convite enviado!");
        setEmail("");
        load();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao convidar");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("list_shares").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Acesso removido");
      load();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">
          <Share2 className="mr-1.5 h-4 w-4" /> Compartilhar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartilhar lista</DialogTitle>
          <DialogDescription>
            {isOwner
              ? "Convide outras Donas Marias por e-mail para colaborar nesta lista."
              : "Esta lista foi compartilhada com você. Apenas a dona pode gerenciar acessos."}
          </DialogDescription>
        </DialogHeader>

        {isOwner && (
          <form onSubmit={invite} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="share-email">E-mail da pessoa</Label>
              <Input
                id="share-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maria@email.com"
                className="mt-1.5"
                required
              />
            </div>
            <Button type="submit" disabled={submitting} className="self-end rounded-full">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1.5 h-4 w-4" />}
              Convidar
            </Button>
          </form>
        )}

        <div className="mt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pessoas com acesso</p>
          {loading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : shares.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Ainda só você tem acesso.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {shares.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{s.full_name ?? "Dona Marisa"}</span>
                  {isOwner && (
                    <button
                      onClick={() => remove(s.id)}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remover acesso"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

