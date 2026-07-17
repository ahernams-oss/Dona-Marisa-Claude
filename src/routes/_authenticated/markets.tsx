import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Store, Plus, Pencil, Trash2, Search, MapPin, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { formatBRL } from "@/lib/utils";
import { checkIsAdmin } from "@/lib/admin.functions";
import {
  listMarkets,
  listRecentPriceReports,
  createMarket,
  updateMarket,
  deleteMarket,
} from "@/lib/markets.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BR_STATES: { uf: string; name: string }[] = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];

export const Route = createFileRoute("/_authenticated/markets")({
  component: MarketsPage,
});

type Market = {
  id: string;
  name: string;
  chain: string | null;
  city: string | null;
  state: string | null;
  color: string | null;
  latitude: number | null;
  longitude: number | null;
  postal_code: string | null;
  address: string | null;
  number: string | null;
  neighborhood: string | null;
};
type Report = { market_id: string; price: number; product_name: string; created_at: string };

const COLORS = ["#6C5CE7", "#FF6B6B", "#1DD1A1", "#FFB400", "#0EA5E9", "#EC4899", "#10B981", "#F97316"];

function MarketsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Market | null>(null);
  const queryClient = useQueryClient();

  const checkFn = useServerFn(checkIsAdmin);
  const { data: adminData } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkFn({}),
  });
  const isAdmin = !!adminData?.isAdmin;

  const listMarketsFn = useServerFn(listMarkets);
  const listReportsFn = useServerFn(listRecentPriceReports);
  const deleteMarketFn = useServerFn(deleteMarket);

  const { data: markets = [] } = useQuery({
    queryKey: ["markets"],
    queryFn: () => listMarketsFn() as Promise<Market[]>,
  });
  const { data: reports = [] } = useQuery({
    queryKey: ["price-reports-recent"],
    queryFn: () => listReportsFn() as Promise<Report[]>,
  });

  function load() {
    queryClient.invalidateQueries({ queryKey: ["markets"] });
    queryClient.invalidateQueries({ queryKey: ["price-reports-recent"] });
  }

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(m: Market) {
    setEditing(m);
    setDialogOpen(true);
  }

  async function handleDelete(m: Market) {
    if (!confirm(`Remover o mercado "${m.name}"?`)) return;
    try {
      await deleteMarketFn({ data: { id: m.id } });
      toast.success("Mercado removido");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover mercado");
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Mercados</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Veja o que a comunidade já reportou em cada mercado.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="shrink-0">
            <Plus className="h-4 w-4" /> Novo mercado
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {markets.map((m) => {
          const mr = reports.filter((r) => r.market_id === m.id);
          return (
            <div key={m.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-xl text-white"
                    style={{ background: m.color ?? "#6C5CE7" }}
                  >
                    <Store className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold leading-tight">{m.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {[m.chain, [m.city, m.state].filter(Boolean).join("/")].filter(Boolean).join(" • ") || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {mr.length} {mr.length === 1 ? "preço" : "preços"}
                  </span>
                  {isAdmin && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openEdit(m)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(m)}
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {mr.length > 0 && (
                <ul className="mt-4 divide-y divide-border">
                  {mr.slice(0, 5).map((r, i) => (
                    <li key={i} className="flex items-center justify-between py-2 text-sm">
                      <span className="truncate">{r.product_name}</span>
                      <span className="font-semibold">{formatBRL(r.price)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <MarketDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        market={editing}
        onSaved={() => {
          setDialogOpen(false);
          load();
        }}
      />
    </div>
  );
}

function MarketDialog({
  open,
  onOpenChange,
  market,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  market: Market | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [chain, setChain] = useState("");
  const [state, setState] = useState<string>("");
  const [city, setCity] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [saving, setSaving] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);
  const [locating, setLocating] = useState(false);
  const createMarketFn = useServerFn(createMarket);
  const updateMarketFn = useServerFn(updateMarket);

  useEffect(() => {
    if (open) {
      setName(market?.name ?? "");
      setChain(market?.chain ?? "");
      setState(market?.state ?? "");
      setCity(market?.city ?? "");
      setColor(market?.color ?? COLORS[0]);
      setLat(market?.latitude != null ? String(market.latitude) : "");
      setLng(market?.longitude != null ? String(market.longitude) : "");
      setPostalCode(market?.postal_code ?? "");
      setAddress(market?.address ?? "");
      setNumber(market?.number ?? "");
      setNeighborhood(market?.neighborhood ?? "");
    }
  }, [open, market]);

  useEffect(() => {
    if (!state) {
      setCities([]);
      return;
    }
    let cancelled = false;
    setLoadingCities(true);

    const fetchFromIbge = () =>
      fetch(`https://servicodadosabertos.ibge.gov.br/api/v1/localidades/estados/${state}/municipios`)
        .then((r) => {
          if (!r.ok) throw new Error("ibge");
          return r.json();
        })
        .then((data: { nome: string }[]) => data.map((d) => d.nome));

    const fetchFromBrasilApi = () =>
      fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${state}?providers=dados-abertos-br,gov,wikipedia`)
        .then((r) => {
          if (!r.ok) throw new Error("brasilapi");
          return r.json();
        })
        .then((data: { nome: string }[]) => data.map((d) => d.nome));

    fetchFromIbge()
      .catch(() => fetchFromBrasilApi())
      .then((names) => {
        if (cancelled) return;
        const unique = Array.from(new Set(names.map((n) => n.toLocaleUpperCase("pt-BR"))))
          .map((n) => n.charAt(0) + n.slice(1).toLocaleLowerCase("pt-BR"));
        setCities(unique.sort((a, b) => a.localeCompare(b, "pt-BR")));
      })
      .catch(() => {
        if (!cancelled) {
          setCities([]);
          toast.error("Não foi possível carregar as cidades. Verifique sua conexão.");
        }
      })
      .finally(() => !cancelled && setLoadingCities(false));

    return () => {
      cancelled = true;
    };
  }, [state]);

  async function handleCepLookup() {
    const cep = postalCode.replace(/\D/g, "");
    if (cep.length !== 8) {
      toast.error("Informe um CEP válido (8 dígitos)");
      return;
    }
    setLookingUpCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data?.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      if (data.uf) setState(data.uf);
      if (data.logradouro) setAddress(data.logradouro);
      if (data.bairro) setNeighborhood(data.bairro);
      if (data.localidade) setCity(data.localidade);
      toast.success("Endereço preenchido");
    } catch {
      toast.error("Falha ao consultar CEP");
    } finally {
      setLookingUpCep(false);
    }
  }

  async function handleUseLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const la = pos.coords.latitude;
        const lo = pos.coords.longitude;
        setLat(String(la.toFixed(6)));
        setLng(String(lo.toFixed(6)));
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${la}&lon=${lo}&accept-language=pt-BR`,
          );
          const data = await res.json();
          const a = data?.address ?? {};
          if (a.postcode) setPostalCode(a.postcode);
          if (a.road) setAddress(a.road);
          if (a.house_number) setNumber(a.house_number);
          if (a.suburb || a.neighbourhood) setNeighborhood(a.suburb ?? a.neighbourhood);
          const uf = (a["ISO3166-2-lvl4"] ?? "").replace("BR-", "");
          if (uf) setState(uf);
          if (a.city || a.town || a.village) setCity(a.city ?? a.town ?? a.village);
          toast.success("Localização capturada");
        } catch {
          toast.success("Coordenadas capturadas");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        toast.error(err.message || "Não foi possível obter a localização");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Informe o nome");
      return;
    }
    if (trimmed.length > 120) {
      toast.error("Nome muito longo");
      return;
    }
    setSaving(true);
    const payload = {
      name: trimmed,
      chain: chain.trim() || null,
      state: state || null,
      city: city || null,
      color,
      latitude: lat.trim() ? Number(lat) : null,
      longitude: lng.trim() ? Number(lng) : null,
      postal_code: postalCode.trim() || null,
      address: address.trim() || null,
      number: number.trim() || null,
      neighborhood: neighborhood.trim() || null,
    };
    try {
      if (market) {
        await updateMarketFn({ data: { id: market.id, payload } });
      } else {
        await createMarketFn({ data: payload });
      }
      toast.success(market ? "Mercado atualizado" : "Mercado criado");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar mercado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{market ? "Editar mercado" : "Novo mercado"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="m-name">Nome *</Label>
            <Input
              id="m-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-chain">Rede</Label>
            <Input
              id="m-chain"
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              maxLength={80}
              placeholder="Ex.: Carrefour"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-cep">CEP</Label>
            <div className="flex gap-2">
              <Input
                id="m-cep"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCepLookup}
                disabled={lookingUpCep}
              >
                {lookingUpCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Preenche automaticamente estado, cidade, bairro e logradouro.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="m-state">Estado</Label>
              <Select
                value={state}
                onValueChange={(v) => {
                  setState(v);
                  setCity("");
                }}
              >
                <SelectTrigger id="m-state">
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {BR_STATES.map((s) => (
                    <SelectItem key={s.uf} value={s.uf}>
                      {s.uf} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-city">Cidade</Label>
              <Select
                value={city}
                onValueChange={setCity}
                disabled={!state || loadingCities}
              >
                <SelectTrigger id="m-city">
                  <SelectValue
                    placeholder={
                      !state
                        ? "Selecione um estado"
                        : loadingCities
                          ? "Carregando…"
                          : "Selecione a cidade"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {city && !cities.includes(city) && (
                    <SelectItem value={city}>{city}</SelectItem>
                  )}
                  {cities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="m-address">Logradouro</Label>
              <Input
                id="m-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, avenida…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-number">Número</Label>
              <Input
                id="m-number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-neigh">Bairro</Label>
              <Input
                id="m-neigh"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Coordenadas</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUseLocation}
                disabled={locating}
              >
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                Usar minha localização
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                id="m-lat"
                type="number"
                step="any"
                placeholder="Latitude"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
              <Input
                id="m-lng"
                type="number"
                step="any"
                placeholder="Longitude"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full ring-offset-2 transition ${
                    color === c ? "ring-2 ring-foreground" : ""
                  }`}
                  style={{ background: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : market ? "Salvar alterações" : "Criar mercado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
