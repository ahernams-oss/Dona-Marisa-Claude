import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Sparkles, Upload, Loader2, Info, Check, ChevronsUpDown, Store, Search, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  listMarketsForReporting,
  listBrands,
  listProductBrandLinks,
  createPriceReport,
} from "@/lib/price-reports.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useGeolocation } from "@/hooks/use-geolocation";
import { SingleProductPicker, type CatalogProduct } from "@/components/SingleProductPicker";
import { BrandPicker, type Brand } from "@/components/BrandPicker";
import { cn, formatBRL, normalizeProductKey, compressImage } from "@/lib/utils";

const MARKET_PAGE_SIZE = 50;
const MARKET_ROW_HEIGHT = 56;

type Market = { id: string; name: string; color: string | null; chain: string | null; city: string | null; state: string | null; latitude: number | null; longitude: number | null };

const marketsQueryOptions = queryOptions({
  queryKey: ["markets", "picker"],
  queryFn: async (): Promise<Market[]> => (await listMarketsForReporting()) as Market[],
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
});

const brandsQueryOptions = queryOptions({
  queryKey: ["brands", "picker"],
  queryFn: async (): Promise<Brand[]> => (await listBrands()) as Brand[],
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
});

type ProductBrandLink = { product_key: string; brand_id: string };

const productBrandsQueryOptions = queryOptions({
  queryKey: ["product-brands", "all"],
  queryFn: async (): Promise<ProductBrandLink[]> => (await listProductBrandLinks()) as ProductBrandLink[],
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
});

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const Route = createFileRoute("/_authenticated/report")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(marketsQueryOptions),
      context.queryClient.ensureQueryData(brandsQueryOptions),
      context.queryClient.ensureQueryData(productBrandsQueryOptions),
    ]),

  component: ReportPage,
  errorComponent: ({ error }) => {
    const router = useRouter();
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="font-medium text-destructive">Não consegui carregar os mercados.</p>
        <p className="mt-1 text-muted-foreground">{error.message}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => router.invalidate()}>
          Tentar novamente
        </Button>
      </div>
    );
  },
  notFoundComponent: () => <div className="text-sm text-muted-foreground">Página não encontrada.</div>,
});

function ReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: markets } = useSuspenseQuery(marketsQueryOptions);
  const { data: brands } = useSuspenseQuery(brandsQueryOptions);
  const { data: productBrands } = useSuspenseQuery(productBrandsQueryOptions);
  const [marketId, setMarketId] = useState("");
  const [marketPickerOpen, setMarketPickerOpen] = useState(false);
  const [marketSearch, setMarketSearch] = useState("");
  const [marketPage, setMarketPage] = useState(1);
  const marketScrollRef = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [aiSeed, setAiSeed] = useState<string>("");
  const [brand, setBrand] = useState<Brand | null>(null);
  const [price, setPrice] = useState("");
  const createPriceReportFn = useServerFn(createPriceReport);
  const selectedMarket = markets.find((m) => m.id === marketId);
  const { position: geo, requesting: geoRequesting, error: geoError, request: requestGeo, clear: clearGeo } = useGeolocation();
  const [sortByDistance, setSortByDistance] = useState(false);

  // Filter brands to those associated with the selected product.
  // Fallback: if no associations exist for this product, allow all brands.
  // "Sem marca" is always allowed.
  const brandsForProduct = useMemo(() => {
    if (!product) return brands;
    const allowed = new Set(
      productBrands.filter((pb) => pb.product_key === product.product_key).map((pb) => pb.brand_id),
    );
    if (allowed.size === 0) return brands;
    return brands.filter((b) => allowed.has(b.id) || b.normalized_name === "sem-marca");
  }, [brands, productBrands, product]);

  // If the currently selected brand becomes invalid for the new product, clear it.
  useEffect(() => {
    if (brand && !brandsForProduct.some((b) => b.id === brand.id)) {
      setBrand(null);
    }
  }, [brandsForProduct, brand]);

  useEffect(() => {
    if (!marketId && markets.length > 0) setMarketId(markets[0].id);
  }, [markets, marketId]);

  const marketsWithDistance = useMemo(() => {
    if (!geo) return markets.map((m) => ({ ...m, distanceKm: null as number | null }));
    const out = markets.map((m) => ({
      ...m,
      distanceKm:
        m.latitude != null && m.longitude != null
          ? haversineKm({ lat: geo.lat, lng: geo.lng }, { lat: m.latitude, lng: m.longitude })
          : null,
    }));
    if (sortByDistance) {
      out.sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return 0;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }
    return out;
  }, [markets, geo, sortByDistance]);

  const filteredMarkets = useMemo(() => {
    const s = marketSearch.toLowerCase().trim();
    if (!s) return marketsWithDistance;
    const tokens = s.split(/\s+/);
    return marketsWithDistance.filter((m) => {
      const hay = [m.name, m.chain, m.city, m.state].filter(Boolean).join(" ").toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [marketsWithDistance, marketSearch]);

  const visibleCount = Math.min(filteredMarkets.length, marketPage * MARKET_PAGE_SIZE);
  const visibleMarkets = useMemo(
    () => filteredMarkets.slice(0, visibleCount),
    [filteredMarkets, visibleCount],
  );

  useEffect(() => {
    setMarketPage(1);
    marketScrollRef.current?.scrollTo({ top: 0 });
  }, [marketSearch, marketPickerOpen]);

  const rowVirtualizer = useVirtualizer({
    count: visibleMarkets.length,
    getScrollElement: () => marketScrollRef.current,
    estimateSize: () => MARKET_ROW_HEIGHT,
    overscan: 8,
  });

  const onFile = async (file: File) => {
    setPhoto(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
    // Auto-extract using AI — usa resolução alta para preservar centavos sobrescritos
    setExtracting(true);
    try {
      const base64 = await compressImage(file, 1600, 0.88);
      const res = await fetch("/api/extract-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "Falha ao ler etiqueta";
        toast.error(msg + " — você pode preencher à mão.");
        return;
      }

      if (data?.error === "unreadable") {
        toast.warning("A IA não conseguiu ler esta foto. Tente uma foto mais nítida, sem reflexos, ou preencha à mão.");
        return;
      }

      let filled = 0;
      if (data.product_name) {
        setAiSeed(String(data.product_name));
        filled++;
      }
      if (data.brand) {
        const aiKey = normalizeProductKey(String(data.brand));
        const match = brands.find((b) => b.normalized_name === aiKey);
        if (match) {
          setBrand(match);
          filled++;
        }
      }
      if (data.price != null && !Number.isNaN(Number(data.price))) {
        setPrice(String(data.price));
        filled++;
      }

      if (filled === 0) {
        toast.warning("A IA respondeu, mas não identificou os campos. Preencha à mão.");
      } else {
        toast.success(`IA leu ${filled} campo(s) — confira o produto no catálogo 💜`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro de rede — preencha à mão");
    } finally {
      setExtracting(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !marketId || !product || !price || !brand) {
      toast.error("Preencha mercado, produto, marca e preço.");
      return;
    }
    setSubmitting(true);
    try {
      let photoUrl: string | null = null;
      if (photo) {
        const ext = photo.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("price-photos").upload(path, photo);
        if (upErr) throw upErr;
        photoUrl = path;
      }
      await createPriceReportFn({
        data: {
          market_id: marketId,
          product_name: product.name,
          product_key: product.product_key,
          brand_id: brand.id,
          brand: brand.name,
          price: Number(price),
          unit: product.unit,
          category: product.category,
          photo_url: photoUrl,
        },
      });
      toast.success(`Preço de ${product.name} (${formatBRL(Number(price))}) reportado!`);
      navigate({ to: "/lists" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-bold">Reportar preço</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tire foto da etiqueta — a IA identifica o produto e o valor pra você.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-6 rounded-3xl border border-border bg-card p-6 shadow-soft">
        {/* Photo */}
        <div>
          <Label>Foto da etiqueta</Label>
          <div className="mt-2">
            {photoPreview ? (
              <div className="relative overflow-hidden rounded-2xl border border-border">
                <img src={photoPreview} alt="Prévia" className="aspect-video w-full object-cover" />
                {extracting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-foreground/70 text-background">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm font-medium">IA lendo a etiqueta...</span>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="grid w-full place-items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-accent/30 p-8 text-center transition hover:border-primary hover:bg-accent"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
                    <Camera className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium">Tirar foto da etiqueta</p>
                  <p className="text-xs text-muted-foreground">A IA lê o nome e o preço automaticamente</p>
                </button>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3 w-3 shrink-0" />
                  No celular, tocar aqui abre a câmera automaticamente. No computador, você pode escolher uma foto da galeria.
                </p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            {photoPreview && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Upload className="h-3 w-3" /> Trocar foto
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="market">Mercado</Label>
            <Popover open={marketPickerOpen} onOpenChange={setMarketPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="market"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={marketPickerOpen}
                  className="mt-1.5 h-10 w-full justify-between font-normal"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {selectedMarket ? (
                      <>
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: selectedMarket.color ?? "hsl(var(--primary))" }}
                        />
                        <span className="truncate">{selectedMarket.name}</span>
                        {(selectedMarket.city || selectedMarket.state) && (
                          <span className="truncate text-xs text-muted-foreground">
                            · {[selectedMarket.city, selectedMarket.state].filter(Boolean).join("/")}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Selecione um mercado…</span>
                    )}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <div className="flex items-center border-b px-3">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <input
                    autoFocus
                    value={marketSearch}
                    onChange={(e) => setMarketSearch(e.target.value)}
                    placeholder="Buscar por nome, rede ou cidade…"
                    className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                {filteredMarkets.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Store className="h-6 w-6 opacity-50" />
                    Nenhum mercado encontrado
                  </div>
                ) : (
                  <>
                    <div
                      ref={marketScrollRef}
                      className="max-h-[300px] overflow-y-auto overflow-x-hidden"
                    >
                      <div
                        style={{
                          height: `${rowVirtualizer.getTotalSize()}px`,
                          position: "relative",
                          width: "100%",
                        }}
                      >
                        {rowVirtualizer.getVirtualItems().map((vRow) => {
                          const m = visibleMarkets[vRow.index];
                          const loc = [m.city, m.state].filter(Boolean).join("/");
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setMarketId(m.id);
                                setMarketPickerOpen(false);
                              }}
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: `${vRow.size}px`,
                                transform: `translateY(${vRow.start}px)`,
                              }}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                marketId === m.id && "bg-accent/50",
                              )}
                            >
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ background: m.color ?? "hsl(var(--primary))" }}
                              />
                              <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate font-medium">{m.name}</span>
                                {(m.chain || loc) && (
                                  <span className="truncate text-xs text-muted-foreground">
                                    {[m.chain, loc].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </div>
                              {m.distanceKm != null && (
                                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                  {m.distanceKm < 10 ? m.distanceKm.toFixed(1) : Math.round(m.distanceKm)} km
                                </span>
                              )}
                              <Check
                                className={cn(
                                  "h-4 w-4 shrink-0",
                                  marketId === m.id ? "opacity-100" : "opacity-0",
                                )}
                              />

                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
                      <span>
                        Mostrando {visibleCount} de {filteredMarkets.length}
                      </span>
                      {visibleCount < filteredMarkets.length && (
                        <button
                          type="button"
                          onClick={() => setMarketPage((p) => p + 1)}
                          className="font-medium text-primary hover:underline"
                        >
                          Carregar mais
                        </button>
                      )}
                    </div>
                  </>
                )}
              </PopoverContent>
            </Popover>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {geo ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant={sortByDistance ? "default" : "outline"}
                    onClick={() => setSortByDistance((v) => !v)}
                    className="h-8 rounded-full"
                  >
                    <MapPin className="mr-1.5 h-3.5 w-3.5" />
                    {sortByDistance ? "Ordenando por distância" : "Ordenar por distância"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => { clearGeo(); setSortByDistance(false); }}
                    className="h-8 rounded-full text-muted-foreground"
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Limpar localização
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { requestGeo(); setSortByDistance(true); }}
                  disabled={geoRequesting}
                  className="h-8 rounded-full"
                >
                  {geoRequesting ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MapPin className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {geoRequesting ? "Localizando…" : "Mercados próximos a mim"}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {markets.length} {markets.length === 1 ? "mercado cadastrado" : "mercados cadastrados"}
              </span>
            </div>
            {geoError && (
              <p className="mt-1 text-xs text-destructive">{geoError}</p>
            )}

          </div>
          <div className="sm:col-span-2">
            <Label>
              Produto {extracting && <Sparkles className="ml-1 inline h-3 w-3 text-primary" />}
            </Label>
            <SingleProductPicker value={product} onChange={setProduct} seed={aiSeed} />
          </div>
          <div className="sm:col-span-2">
            <Label>Marca</Label>
            <BrandPicker
              value={brand}
              onChange={setBrand}
              brands={brandsForProduct}
              productKey={product?.product_key ?? null}
              productCategory={product?.category ?? null}
            />
            {product && brandsForProduct.length < brands.length && (
              <p className="mt-1 text-xs text-muted-foreground">
                Mostrando marcas associadas a <strong>{product.name}</strong>. Não encontrou? Solicite o cadastro.
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              A marca é obrigatória — escolha "Sem marca" se o produto não tiver uma marca específica.
              Não encontrou? Solicite o cadastro para um moderador.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="price">Preço (R$)</Label>
            <Input id="price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" className="mt-1.5 text-lg font-semibold" required />
          </div>
        </div>

        <Button type="submit" disabled={submitting || extracting || !product || !brand} className="w-full rounded-full" size="lg">
          {submitting ? "Salvando..." : "Reportar preço"}
        </Button>
      </form>
    </div>
  );
}
