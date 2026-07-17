import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, ListChecks, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listShoppingLists, createShoppingList, deleteShoppingList } from "@/lib/shopping-lists.functions";

export const Route = createFileRoute("/_authenticated/lists/")({
  component: ListsPage,
});

type ShoppingList = {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
  item_count?: number;
};

function ListsPage() {
  const { user } = useAuth();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const listShoppingListsFn = useServerFn(listShoppingLists);
  const createShoppingListFn = useServerFn(createShoppingList);
  const deleteShoppingListFn = useServerFn(deleteShoppingList);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listShoppingListsFn();
      setLists(
        (data ?? []).map((l: { id: string; name: string; created_at: string; user_id: string; list_items: { count: number }[] }) => ({
          id: l.id,
          name: l.name,
          created_at: l.created_at,
          user_id: l.user_id,
          item_count: l.list_items?.[0]?.count ?? 0,
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar listas");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user) return;
    try {
      await createShoppingListFn({ data: { name: newName.trim() } });
      setNewName("");
      toast.success("Lista criada!");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar lista");
    }
  };

  const deleteList = async (id: string) => {
    if (!confirm("Excluir esta lista?")) return;
    try {
      await deleteShoppingListFn({ data: { id } });
      toast.success("Lista excluída");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir lista");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Minhas listas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Crie listas e compare preços entre mercados.</p>
        </div>
      </div>

      <form onSubmit={createList} className="mt-6 flex gap-2 rounded-2xl border border-border bg-card p-2 shadow-soft">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Ex: Compras da semana"
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button type="submit" className="rounded-full">
          <Plus className="mr-1 h-4 w-4" /> Nova lista
        </Button>
      </form>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))
        ) : lists.length === 0 ? (
          <div className="col-span-full rounded-3xl border-2 border-dashed border-border bg-card/50 p-10 text-center">
            <ListChecks className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium">Nenhuma lista ainda</p>
            <p className="text-sm text-muted-foreground">Crie sua primeira lista de compras.</p>
          </div>
        ) : (
          lists.map((l) => {
            const isShared = user && l.user_id !== user.id;
            return (
              <div key={l.id} className="group relative rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:shadow-glow">
                <Link to="/lists/$id" params={{ id: l.id }} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg font-bold">{l.name}</h3>
                    {isShared && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
                        <Users className="h-3 w-3" /> Compartilhada
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{l.item_count} {l.item_count === 1 ? "item" : "itens"}</p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </Link>
                {!isShared && (
                  <button
                    onClick={() => deleteList(l.id)}
                    className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="Excluir lista"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
