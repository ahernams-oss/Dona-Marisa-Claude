import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Shield, ShieldOff, Search, Users, Crown, Store, Tag, Package, GitMerge, CheckCircle2, AlertTriangle, Sparkles, ThumbsUp, ThumbsDown, LifeBuoy, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import {
  checkIsStaff,
  listUsers,
  setUserRole,
  listPricesByMarket,
  listProductKeysUsage,
  mergeProductKey,
  promoteToCatalog,
  listBrandRequests,
  reviewBrandRequest,
  listProductBrandAssociations,
  setProductBrandAssociations,
  listAllBrands,
} from "@/lib/admin.functions";
import {
  listAllSupportMessages,
  replySupportMessage,
} from "@/lib/support.functions";
import { AttachmentLink } from "@/routes/_authenticated/support";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const checkFn = useServerFn(checkIsStaff);
  const listFn = useServerFn(listUsers);
  const setRoleFn = useServerFn(setUserRole);
  const pricesFn = useServerFn(listPricesByMarket);

  const staffQuery = useQuery({
    queryKey: ["is-staff"],
    queryFn: () => checkFn({}),
  });

  const isAdmin = staffQuery.data?.isAdmin;
  const isModerator = staffQuery.data?.isModerator;
  const isStaff = isAdmin || isModerator;

  useEffect(() => {
    if (staffQuery.isSuccess && !isStaff) {
      toast.error("Acesso restrito a administradores e moderadores");
      navigate({ to: "/lists" });
    }
  }, [staffQuery.isSuccess, isStaff, navigate]);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn({}),
    enabled: !!isAdmin,
  });

  const pricesQuery = useQuery({
    queryKey: ["admin-prices-by-market"],
    queryFn: () => pricesFn({}),
    enabled: !!isAdmin,
  });

  const mutate = useMutation({
    mutationFn: (vars: { userId: string; role: "admin" | "moderator" | "user"; grant: boolean }) =>
      setRoleFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Permissão atualizada");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao atualizar"),
  });

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const list = usersQuery.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q),
    );
  }, [usersQuery.data, search]);

  const adminCount = (usersQuery.data ?? []).filter((u) => u.roles.includes("admin")).length;
  const total = usersQuery.data?.length ?? 0;

  if (staffQuery.isLoading || !isStaff) {
    return (
      <div className="py-20 text-center text-muted-foreground">Verificando permissões…</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Administração</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie usuários e permissões do sistema.
          </p>
        </div>
        <Shield className="h-8 w-8 text-primary" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Usuários totais
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Administradores
            </CardTitle>
            <Crown className="h-4 w-4 text-coral" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{adminCount}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={isAdmin ? "users" : "brands"} className="space-y-4">
        <TabsList>
          {isAdmin && (
            <TabsTrigger value="users">
              <Users className="mr-2 h-4 w-4" /> Usuários
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="prices">
              <Tag className="mr-2 h-4 w-4" /> Preços por mercado
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="products">
              <Package className="mr-2 h-4 w-4" /> Produtos
            </TabsTrigger>
          )}
          <TabsTrigger value="brands">
            <Sparkles className="mr-2 h-4 w-4" /> Marcas
          </TabsTrigger>
          <TabsTrigger value="support">
            <LifeBuoy className="mr-2 h-4 w-4" /> Suporte
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Usuários</CardTitle>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome ou e-mail"
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent>
              {usersQuery.isLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Último acesso</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((u) => {
                      const isAdminUser = u.roles.includes("admin");
                      const isModUser = u.roles.includes("moderator");
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="font-medium">{u.full_name ?? "—"}</div>
                            {u.city && (
                              <div className="text-xs text-muted-foreground">{u.city}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{u.email}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.last_sign_in_at
                              ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR")
                              : "Nunca"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {isAdminUser && (
                                <Badge className="bg-coral text-coral-foreground hover:bg-coral/90">Admin</Badge>
                              )}
                              {isModUser && (
                                <Badge className="bg-violet-100 text-violet-900 hover:bg-violet-100">Moderador</Badge>
                              )}
                              {!isAdminUser && !isModUser && <Badge variant="secondary">Usuário</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {isAdminUser ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={mutate.isPending}
                                  onClick={() => mutate.mutate({ userId: u.id, role: "admin", grant: false })}
                                >
                                  <ShieldOff className="h-3.5 w-3.5" /> Revogar admin
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  disabled={mutate.isPending}
                                  onClick={() => mutate.mutate({ userId: u.id, role: "admin", grant: true })}
                                >
                                  <Shield className="h-3.5 w-3.5" /> Admin
                                </Button>
                              )}
                              {isModUser ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={mutate.isPending}
                                  onClick={() => mutate.mutate({ userId: u.id, role: "moderator", grant: false })}
                                >
                                  <ShieldOff className="h-3.5 w-3.5" /> Revogar moderador
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={mutate.isPending}
                                  onClick={() => mutate.mutate({ userId: u.id, role: "moderator", grant: true })}
                                >
                                  <Sparkles className="h-3.5 w-3.5" /> Moderador
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          Nenhum usuário encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prices">
          <Card>
            <CardHeader>
              <CardTitle>Preços reportados por mercado</CardTitle>
            </CardHeader>
            <CardContent>
              {pricesQuery.isLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
              ) : (pricesQuery.data ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum mercado cadastrado.
                </p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {(pricesQuery.data ?? []).map((m: any) => (
                    <AccordionItem key={m.id} value={m.id}>
                      <AccordionTrigger>
                        <div className="flex w-full items-center justify-between gap-3 pr-4">
                          <div className="flex items-center gap-2 text-left">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{m.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {[m.neighborhood, m.city, m.state].filter(Boolean).join(" · ") || "—"}
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary">{m.prices.length} preços</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        {m.prices.length === 0 ? (
                          <p className="py-4 text-center text-sm text-muted-foreground">
                            Sem preços reportados ainda.
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead>Marca</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead className="text-right">Preço</TableHead>
                                <TableHead>Unidade</TableHead>
                                <TableHead>Reportado por</TableHead>
                                <TableHead>Data</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {m.prices.map((p: any) => (
                                <TableRow key={p.id}>
                                  <TableCell className="font-medium">{p.product_name}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {p.brand ?? "—"}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {p.category ?? "—"}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {new Intl.NumberFormat("pt-BR", {
                                      style: "currency",
                                      currency: "BRL",
                                    }).format(Number(p.price))}
                                  </TableCell>
                                  <TableCell className="text-sm">{p.unit ?? "—"}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {p.reporter_name ?? "—"}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <ProductsTab />
        </TabsContent>

        <TabsContent value="brands">
          <BrandsTab />
        </TabsContent>

        <TabsContent value="support">
          <SupportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProductsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listProductKeysUsage);
  const mergeFn = useServerFn(mergeProductKey);
  const promoteFn = useServerFn(promoteToCatalog);

  const q = useQuery({
    queryKey: ["admin-product-keys"],
    queryFn: () => listFn({}),
  });

  const [search, setSearch] = useState("");
  const [merging, setMerging] = useState<null | {
    product_key: string;
    sample_name: string;
    category: string | null;
    unit: string | null;
    reports: number;
    list_items: number;
  }>(null);
  const [targetId, setTargetId] = useState("");

  const merge = useMutation({
    mutationFn: (vars: { from: string; toCatalogId: string }) => mergeFn({ data: vars }),
    onSuccess: (res) => {
      toast.success(
        `Mesclado · ${res.reportsUpdated} preços e ${res.itemsUpdated} itens atualizados`,
      );
      qc.invalidateQueries({ queryKey: ["admin-product-keys"] });
      qc.invalidateQueries({ queryKey: ["admin-prices-by-market"] });
      setMerging(null);
      setTargetId("");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao mesclar"),
  });

  const promote = useMutation({
    mutationFn: (vars: { product_key: string; name: string; category: string; unit: string }) =>
      promoteFn({ data: vars }),
    onSuccess: () => {
      toast.success("Produto adicionado ao catálogo");
      qc.invalidateQueries({ queryKey: ["admin-product-keys"] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao promover"),
  });

  const rows = q.data?.rows ?? [];
  const catalog = q.data?.catalog ?? [];
  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return rows;
    return rows.filter(
      (r) => r.product_key.toLowerCase().includes(s) || r.sample_name.toLowerCase().includes(s),
    );
  }, [rows, search]);

  const orphanCount = rows.filter((r) => !r.in_catalog).length;

  const [brandsDialogProductKey, setBrandsDialogProductKey] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Produtos usados</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Identifique e mescle entradas divergentes (ex.: <em>arroz-5kg</em> vs{" "}
            <em>arroz-5kg-tio-joao</em>) para manter a comparação correta entre mercados.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto ou chave"
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setBrandsDialogProductKey("")}>
            <Sparkles className="mr-1 h-4 w-4" /> Marcas por produto
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2 text-xs">
              <Badge variant="secondary">{rows.length} chaves</Badge>
              {orphanCount > 0 ? (
                <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                  <AlertTriangle className="mr-1 h-3 w-3" /> {orphanCount} fora do catálogo
                </Badge>
              ) : (
                <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Tudo no catálogo
                </Badge>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto (amostra)</TableHead>
                  <TableHead className="font-mono text-xs">product_key</TableHead>
                  <TableHead className="text-center">Reportes</TableHead>
                  <TableHead className="text-center">Em listas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.product_key}>
                    <TableCell className="font-medium">{r.sample_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.product_key}
                    </TableCell>
                    <TableCell className="text-center">{r.reports}</TableCell>
                    <TableCell className="text-center">{r.list_items}</TableCell>
                    <TableCell>
                      {r.in_catalog ? (
                        <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                          No catálogo
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                          Órfão
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {r.in_catalog && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setBrandsDialogProductKey(r.product_key)}
                          >
                            <Sparkles className="mr-1 h-3.5 w-3.5" /> Marcas
                          </Button>
                        )}
                        {!r.in_catalog && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setMerging(r)}>
                              <GitMerge className="mr-1 h-3.5 w-3.5" /> Mesclar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={promote.isPending || !r.category || !r.unit}
                              onClick={() =>
                                promote.mutate({
                                  product_key: r.product_key,
                                  name: r.sample_name,
                                  category: r.category ?? "outros",
                                  unit: r.unit ?? "un",
                                })
                              }
                            >
                              <Package className="mr-1 h-3.5 w-3.5" /> Promover
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Nada encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>

      <Dialog open={!!merging} onOpenChange={(o) => !o && setMerging(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mesclar produto</DialogTitle>
            <DialogDescription>
              Todos os reportes e itens com <strong className="font-mono">{merging?.product_key}</strong> serão
              reescritos para o produto escolhido no catálogo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">De</p>
              <p className="font-medium">{merging?.sample_name}</p>
              <p className="text-xs text-muted-foreground">
                {merging?.reports} reporte(s) · {merging?.list_items} item(s) em listas
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Para (produto do catálogo)
              </label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecione…</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.unit}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMerging(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!targetId || merge.isPending}
              onClick={() =>
                merging && merge.mutate({ from: merging.product_key, toCatalogId: targetId })
              }
            >
              <GitMerge className="mr-1 h-4 w-4" /> Mesclar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductBrandsDialog
        productKey={brandsDialogProductKey}
        catalog={catalog}
        onClose={() => setBrandsDialogProductKey(null)}
      />
    </Card>
  );
}

function ProductBrandsDialog({
  productKey,
  catalog,
  onClose,
}: {
  productKey: string | null;
  catalog: Array<{ id: string; name: string; product_key: string; unit: string }>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listAssocFn = useServerFn(listProductBrandAssociations);
  const setAssocFn = useServerFn(setProductBrandAssociations);
  const listBrandsFn = useServerFn(listAllBrands);

  const [selectedKey, setSelectedKey] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const open = productKey !== null;
  const activeKey = selectedKey || productKey || "";

  const brandsQ = useQuery({
    queryKey: ["admin-all-brands"],
    queryFn: () => listBrandsFn({}),
    enabled: open,
  });

  const assocQ = useQuery({
    queryKey: ["admin-product-brands", activeKey],
    queryFn: () => listAssocFn({ data: { product_key: activeKey } }),
    enabled: open && !!activeKey,
  });

  useEffect(() => {
    if (open) setSelectedKey(productKey || "");
  }, [open, productKey]);

  useEffect(() => {
    if (assocQ.data) setSelected(new Set(assocQ.data.map((b: any) => b.id)));
  }, [assocQ.data]);

  const save = useMutation({
    mutationFn: () =>
      setAssocFn({ data: { product_key: activeKey, brand_ids: Array.from(selected) } }),
    onSuccess: () => {
      toast.success("Associações atualizadas");
      qc.invalidateQueries({ queryKey: ["admin-product-brands", activeKey] });
      qc.invalidateQueries({ queryKey: ["product-brands"] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao salvar"),
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const brands = brandsQ.data ?? [];
  const filteredBrands = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return brands;
    return brands.filter(
      (b: any) =>
        b.name.toLowerCase().includes(s) || (b.category ?? "").toLowerCase().includes(s),
    );
  }, [brands, search]);

  const currentProduct = catalog.find((c) => c.product_key === activeKey);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Marcas por produto</DialogTitle>
          <DialogDescription>
            Defina quais marcas estão disponíveis para o usuário escolher ao reportar este produto.
            Se nenhuma marca estiver associada, todas ficam disponíveis como fallback.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Produto do catálogo
            </label>
            <select
              value={activeKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecione…</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.product_key}>
                  {c.name} · {c.unit}
                </option>
              ))}
            </select>
            {currentProduct && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {currentProduct.product_key}
              </p>
            )}
          </div>

          {activeKey && (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar marca"
                  className="pl-8"
                />
              </div>

              <div className="max-h-80 overflow-auto rounded-lg border border-border">
                {brandsQ.isLoading || assocQ.isLoading ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
                ) : filteredBrands.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma marca encontrada.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {filteredBrands.map((b: any) => (
                      <li key={b.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                          <input
                            type="checkbox"
                            checked={selected.has(b.id)}
                            onChange={() => toggle(b.id)}
                            className="h-4 w-4"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{b.name}</div>
                            {b.category && (
                              <div className="text-xs text-muted-foreground">{b.category}</div>
                            )}
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {selected.size} marca(s) associada(s) a este produto.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!activeKey || save.isPending} onClick={() => save.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BrandsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const listFn = useServerFn(listBrandRequests);
  const reviewFn = useServerFn(reviewBrandRequest);

  const query = useQuery({
    queryKey: ["admin-brand-requests", status],
    queryFn: () => listFn({ data: { status } }),
  });

  const review = useMutation({
    mutationFn: (vars: { id: string; action: "approve" | "reject"; notes?: string }) =>
      reviewFn({ data: vars }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-brand-requests"] });
      qc.invalidateQueries({ queryKey: ["brands"] });
      toast.success(vars.action === "approve" ? "Marca aprovada" : "Solicitação rejeitada");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Solicitações de marcas</CardTitle>
          <CardDescription>Aprovar ou rejeitar novas marcas sugeridas pelos usuários.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "default" : "outline"}
              onClick={() => setStatus(s)}
            >
              {s === "pending" ? "Pendentes" : s === "approved" ? "Aprovadas" : s === "rejected" ? "Rejeitadas" : "Todas"}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (query.data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma solicitação.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead>Categoria sugerida</TableHead>
                <TableHead>Solicitado por</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data ?? []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.normalized_name}</div>
                  </TableCell>
                  <TableCell className="text-sm">{r.suggested_category ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    <div>{r.requested_by_name ?? "—"}</div>
                    <div className="text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.status === "pending" && <Badge variant="secondary">Pendente</Badge>}
                    {r.status === "approved" && (
                      <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Aprovada</Badge>
                    )}
                    {r.status === "rejected" && <Badge variant="outline">Rejeitada</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={review.isPending}
                          onClick={() => review.mutate({ id: r.id, action: "approve" })}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" /> Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={review.isPending}
                          onClick={() => {
                            const notes = window.prompt("Motivo da rejeição (opcional):") ?? undefined;
                            review.mutate({ id: r.id, action: "reject", notes });
                          }}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" /> Rejeitar
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {r.reviewed_by_name ?? "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function SupportTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllSupportMessages);
  const replyFn = useServerFn(replySupportMessage);

  const [statusFilter, setStatusFilter] = useState<"open" | "in_progress" | "resolved" | "all">(
    "open",
  );
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: ["admin-support", statusFilter],
    queryFn: () => listFn({ data: { status: statusFilter } }),
  });

  const mutate = useMutation({
    mutationFn: (vars: {
      id: string;
      reply?: string;
      status: "open" | "in_progress" | "resolved";
    }) => replyFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-support"] });
      toast.success("Solicitação atualizada");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao atualizar"),
  });

  const rows = q.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Solicitações de suporte</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Responda dúvidas e sugestões enviadas pelos usuários.
          </p>
        </div>
        <div className="w-full sm:w-48">
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Abertas</SelectItem>
              <SelectItem value="in_progress">Em análise</SelectItem>
              <SelectItem value="resolved">Resolvidas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma solicitação nesta categoria.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((m: any) => {
              const draft = replyDrafts[m.id] ?? m.staff_reply ?? "";
              return (
                <li key={m.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{m.subject}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {m.user_name ?? m.user_email ?? m.user_id} ·{" "}
                        {new Date(m.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {m.status === "open"
                        ? "Aberta"
                        : m.status === "in_progress"
                          ? "Em análise"
                          : "Resolvida"}
                    </Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
                  {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.attachments.map((a: any) => (
                        <AttachmentLink key={a.path} messageId={m.id} att={a} />
                      ))}
                    </div>
                  )}

                  {m.staff_reply && (
                    <div className="mt-2 rounded-md bg-accent p-3 text-sm">
                      <div className="mb-1 text-xs font-semibold text-muted-foreground">
                        Resposta anterior
                        {m.replied_by_name ? ` · ${m.replied_by_name}` : ""}
                        {m.replied_at
                          ? ` · ${new Date(m.replied_at).toLocaleString("pt-BR")}`
                          : ""}
                      </div>
                      <p className="whitespace-pre-wrap">{m.staff_reply}</p>
                    </div>
                  )}

                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={draft}
                      onChange={(e) =>
                        setReplyDrafts((d) => ({ ...d, [m.id]: e.target.value }))
                      }
                      placeholder="Escreva uma resposta…"
                      rows={3}
                      maxLength={2000}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={mutate.isPending}
                        onClick={() => mutate.mutate({ id: m.id, status: "in_progress" })}
                      >
                        Marcar em análise
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={mutate.isPending || !draft.trim()}
                        onClick={() =>
                          mutate.mutate({ id: m.id, status: m.status, reply: draft.trim() })
                        }
                      >
                        <Send className="mr-1 h-3.5 w-3.5" /> Salvar resposta
                      </Button>
                      <Button
                        size="sm"
                        disabled={mutate.isPending}
                        onClick={() =>
                          mutate.mutate({
                            id: m.id,
                            status: "resolved",
                            reply: draft.trim() ? draft.trim() : undefined,
                          })
                        }
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Resolver
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}


