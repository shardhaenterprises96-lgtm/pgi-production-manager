import React, { useState, useMemo } from "react";
import {
  useListBoms,
  useListWorkloadCards,
  useAssembleItem,
  useListProducts,
  useGetLowStockAlerts,
  getListWorkloadCardsQueryKey,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Factory, Loader2, PackageCheck, AlertCircle, CheckCircle2, Package, Search, X,
  ListChecks, ArrowRight, AlertTriangle,
} from "lucide-react";

export default function Manufacturing() {
  // Lifted state so the Workload tab can deep-link into Assemble Item with a
  // specific BOM pre-selected.
  const [tab, setTab] = useState("workload");
  const [pendingAssembleBomId, setPendingAssembleBomId] = useState<string>("");

  const startAssemble = (bomId: number) => {
    setPendingAssembleBomId(String(bomId));
    setTab("assemble");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manufacturing</h1>
        <p className="text-muted-foreground mt-2">
          Check what needs to be produced and assemble finished products from raw materials.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="workload" data-testid="tab-workload">Workload</TabsTrigger>
          <TabsTrigger value="assemble" data-testid="tab-assemble">Assemble Item</TabsTrigger>
        </TabsList>

        <TabsContent value="workload" className="mt-6">
          <WorkloadTab onStartAssemble={startAssemble} />
        </TabsContent>

        <TabsContent value="assemble" className="mt-6">
          <AssembleTab
            initialBomId={pendingAssembleBomId}
            onConsumeInitialBomId={() => setPendingAssembleBomId("")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --------------------------- WORKLOAD TAB ---------------------------
// Shows products that are below their minimum stock threshold. If a BOM exists
// for the product, the user can jump straight into Assemble Item with that
// recipe pre-selected. Otherwise we hint that they need to either reorder or
// create a BOM.

function WorkloadTab({ onStartAssemble }: { onStartAssemble: (bomId: number) => void }) {
  const { data: alerts, isLoading } = useGetLowStockAlerts();
  const { data: boms } = useListBoms();
  const { data: products } = useListProducts();

  const bomByFinishedProduct = useMemo(() => {
    const m = new Map<number, any>();
    (boms ?? []).forEach((b: any) => m.set(b.finishedProductId, b));
    return m;
  }, [boms]);

  const productById = useMemo(() => {
    const m = new Map<number, any>();
    (products ?? []).forEach((p: any) => m.set(p.id, p));
    return m;
  }, [products]);

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed rounded-lg">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600 opacity-40 mb-4" />
        <h3 className="text-lg font-medium">All stocks healthy</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          No products are below their minimum stock threshold right now. Items will appear here
          automatically when stock dips below the threshold set in Inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-primary" />
            Production Workload
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Products that have fallen below their minimum stock threshold — top of the queue first.
          </p>
        </div>
        <Badge variant="destructive" data-testid="badge-workload-count">
          {alerts.length} item{alerts.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs uppercase text-muted-foreground font-medium bg-muted/50">
          <div className="col-span-4">Product</div>
          <div className="col-span-2 text-right">In Stock</div>
          <div className="col-span-2 text-right">Min Threshold</div>
          <div className="col-span-2 text-right">Shortage</div>
          <div className="col-span-2 text-right">Action</div>
        </div>
        <div className="divide-y">
          {alerts.map((a: any) => {
            const bom = bomByFinishedProduct.get(a.id);
            const product = productById.get(a.id);
            const imageUrl = product?.imageUrl;
            const itemCode = product?.itemCode;
            const shortage = Math.max(0, Number(a.minStockThreshold) - Number(a.currentStock));
            const critical = Number(a.currentStock) <= 0;
            return (
              <div
                key={a.id}
                className="grid grid-cols-12 gap-3 px-4 py-3 items-center"
                data-testid={`workload-row-${a.id}`}
              >
                <div className="col-span-4 min-w-0 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-md border bg-muted/30 shrink-0 overflow-hidden flex items-center justify-center">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={a.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Package className="w-5 h-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium line-clamp-1 flex items-center gap-2">
                      {critical && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}
                      {a.name}
                    </div>
                    {itemCode && (
                      <div className="text-[11px] text-muted-foreground font-mono">{itemCode}</div>
                    )}
                    {bom ? (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Recipe ready · {bom.outputQuantity} per batch · {bom.items.length} materials
                      </div>
                    ) : (
                      <div className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                        No BOM defined — reorder from vendor or set up a recipe
                      </div>
                    )}
                  </div>
                </div>
                <div className={`col-span-2 text-right tabular-nums font-medium ${critical ? "text-destructive" : ""}`}>
                  {Number(a.currentStock).toLocaleString()} {a.unit ?? ""}
                </div>
                <div className="col-span-2 text-right tabular-nums text-muted-foreground">
                  {Number(a.minStockThreshold).toLocaleString()} {a.unit ?? ""}
                </div>
                <div className="col-span-2 text-right tabular-nums">
                  <Badge variant={critical ? "destructive" : "secondary"}>
                    {shortage.toLocaleString()} {a.unit ?? ""}
                  </Badge>
                </div>
                <div className="col-span-2 flex justify-end">
                  {bom ? (
                    <Button
                      size="sm"
                      onClick={() => onStartAssemble(bom.id)}
                      data-testid={`button-assemble-from-workload-${a.id}`}
                    >
                      <PackageCheck className="w-3.5 h-3.5 mr-1" />
                      Assemble
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      No Recipe
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --------------------------- ASSEMBLE TAB ---------------------------

function AssembleTab({
  initialBomId,
  onConsumeInitialBomId,
}: {
  initialBomId?: string;
  onConsumeInitialBomId?: () => void;
}) {
  const { data: boms, isLoading: bomsLoading } = useListBoms();
  const { data: products } = useListProducts({});
  const { data: workloads } = useListWorkloadCards();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const assembleItem = useAssembleItem();

  const [bomId, setBomId] = useState<string>("");
  const [batches, setBatches] = useState<string>("1");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  // When the Workload tab requests an assembly, accept the pre-selection
  // exactly once and immediately clear it so subsequent navigation back to
  // this tab doesn't snap the selection again.
  React.useEffect(() => {
    if (initialBomId) {
      setBomId(initialBomId);
      setSearch("");
      onConsumeInitialBomId?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBomId]);

  const selectedBom = useMemo(
    () => boms?.find((b: any) => String(b.id) === bomId),
    [boms, bomId],
  );

  const productById = useMemo(() => {
    const m = new Map<number, any>();
    products?.forEach((p: any) => m.set(p.id, p));
    return m;
  }, [products]);

  const filteredBoms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return boms ?? [];
    return (boms ?? []).filter((b: any) => {
      const prod = productById.get(b.finishedProductId);
      const haystack = [
        b.finishedProductName,
        prod?.itemCode,
        prod?.brand,
        prod?.group,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [boms, search, productById]);

  const batchCount = Math.max(0, Number(batches) || 0);
  const outputUnits = selectedBom ? batchCount * Number(selectedBom.outputQuantity) : 0;

  type Requirement = {
    materialProductId: number;
    materialProductName: string;
    unit: string;
    required: number;
    available: number;
    sufficient: boolean;
  };

  const requirements: Requirement[] = useMemo(() => {
    if (!selectedBom) return [];
    return selectedBom.items.map((it: any) => {
      const required = Number(it.quantity) * batchCount;
      const prod = productById.get(it.materialProductId);
      const available = Number(prod?.currentStock ?? 0);
      return {
        materialProductId: it.materialProductId,
        materialProductName: it.materialProductName,
        unit: it.unit,
        required,
        available,
        sufficient: available >= required,
      };
    });
  }, [selectedBom, batchCount, productById]);

  const anyShortage = requirements.some(r => !r.sufficient);
  const canAssemble =
    !!selectedBom && batchCount > 0 && !anyShortage && !submitting;

  const recentAssemblies = useMemo(() => {
    return (workloads ?? [])
      .filter((c: any) => c.status === "done")
      .slice(0, 6);
  }, [workloads]);

  const handleAssemble = async () => {
    if (!selectedBom || batchCount <= 0) return;
    setSubmitting(true);
    try {
      // Single atomic call — server runs the entire recipe (debit raw,
      // credit finished, write movements, create the done workload card) in
      // one SERIALIZABLE transaction. No orphan state possible on failure.
      await assembleItem.mutateAsync({
        data: { bomId: selectedBom.id, batches: batchCount },
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListWorkloadCardsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }),
      ]);

      toast({
        title: "Assembly complete",
        description: `Produced ${outputUnits} of ${selectedBom.finishedProductName}. Raw materials were debited.`,
      });
      setBatches("1");
    } catch (err: any) {
      let title = "Assembly failed";
      let desc = err?.message ?? "Server error";
      try {
        const body = err?.response ? await err.response.json() : null;
        if (body?.error) desc = String(body.error).slice(0, 300);
        if (Array.isArray(body?.shortages) && body.shortages.length > 0) {
          title = "Insufficient raw material";
          desc = body.shortages
            .map((s: any) => `${s.materialProductName}: need ${s.required} ${s.unit}, have ${s.available}`)
            .join("; ");
        }
      } catch {}
      toast({ title, description: desc, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (bomsLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    );
  }

  if (!boms || boms.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed rounded-lg">
        <Factory className="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-4" />
        <h3 className="text-lg font-medium">No BOMs available</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          To assemble items, first define a Bill of Material in the BOM tab so the system knows
          which raw materials are consumed.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        {/* BOM picker — visual catalog of recipes */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-semibold">Pick a Recipe to Assemble</h2>
            <span className="text-xs text-muted-foreground">
              {filteredBoms.length} of {boms.length} recipe{boms.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name, item code, brand or group…"
              className="pl-9 pr-9"
              data-testid="input-assemble-search"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
                data-testid="button-clear-search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {filteredBoms.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-lg text-sm text-muted-foreground">
              No recipes match "{search}".
            </div>
          ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredBoms.map((b: any) => {
              const prod = productById.get(b.finishedProductId);
              const isSelected = String(b.id) === bomId;
              const finishedStock = Number(prod?.currentStock ?? 0);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBomId(String(b.id))}
                  data-testid={`card-bom-${b.id}`}
                  className={`group relative text-left rounded-lg border overflow-hidden flex flex-col transition-all hover:shadow-md ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/40 shadow-sm"
                      : "border-border/50 hover:border-border"
                  }`}
                >
                  <div className="aspect-square bg-muted flex items-center justify-center relative p-4">
                    {prod?.imageUrl ? (
                      <img
                        src={prod.imageUrl}
                        alt={b.finishedProductName}
                        className="object-contain h-full w-full"
                      />
                    ) : (
                      <Package className="w-14 h-14 opacity-10" />
                    )}
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px] px-1.5">
                      Stock: {finishedStock}
                    </Badge>
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    {prod?.itemCode && (
                      <div className="text-[10px] text-muted-foreground font-mono mb-0.5 truncate">
                        {prod.itemCode}
                      </div>
                    )}
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-2">
                      {b.finishedProductName}
                    </h3>
                    <div className="mt-auto flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Per batch</span>
                      <span className="font-medium tabular-nums">
                        {b.outputQuantity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-0.5">
                      <span className="text-muted-foreground">Materials</span>
                      <span className="font-medium tabular-nums">{b.items.length}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          )}
        </div>

        {/* Assembly panel — appears once a recipe is picked */}
        {selectedBom ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <PackageCheck className="w-5 h-5 text-primary" />
                Assemble: {selectedBom.finishedProductName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <Label>Batches *</Label>
                  <Input
                    type="number" min="1" step="1"
                    value={batches}
                    onChange={(e) => setBatches(e.target.value)}
                    data-testid="input-assemble-batches"
                    className="w-32"
                  />
                </div>
                <div className="rounded-lg border bg-muted/30 px-3 py-2 flex items-center gap-2 text-sm flex-1 min-w-[240px]">
                  <span className="text-muted-foreground">Will produce</span>
                  <span className="font-semibold text-foreground tabular-nums" data-testid="text-output-units">
                    {outputUnits}
                  </span>
                  <Badge variant="outline" className="ml-auto">
                    {batchCount} × {selectedBom.outputQuantity}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base">Material Consumption Check</Label>
                <div className="rounded-lg border divide-y">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs uppercase text-muted-foreground font-medium bg-muted/50">
                    <div className="col-span-5">Material</div>
                    <div className="col-span-3 text-right">Required</div>
                    <div className="col-span-3 text-right">In Stock</div>
                    <div className="col-span-1 text-right"></div>
                  </div>
                  {requirements.map((r) => (
                    <div
                      key={r.materialProductId}
                      className="grid grid-cols-12 gap-2 px-3 py-2.5 text-sm items-center"
                      data-testid={`req-row-${r.materialProductId}`}
                    >
                      <div className="col-span-5 line-clamp-1">{r.materialProductName}</div>
                      <div className="col-span-3 text-right tabular-nums">
                        {r.required.toLocaleString()} {r.unit}
                      </div>
                      <div className={`col-span-3 text-right tabular-nums ${r.sufficient ? "" : "text-destructive font-semibold"}`}>
                        {r.available.toLocaleString()} {r.unit}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {r.sufficient ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {anyShortage && batchCount > 0 && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Insufficient raw material for one or more inputs. Reduce batch count or restock.
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleAssemble}
                  disabled={!canAssemble}
                  data-testid="button-assemble"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <PackageCheck className="w-4 h-4 mr-2" />
                  Assemble Now
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-10 border border-dashed rounded-lg text-sm text-muted-foreground">
            Pick a recipe above to set batches and check material stock.
          </div>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Recent Assemblies</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAssemblies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No assemblies yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentAssemblies.map((c: any) => (
                <li key={c.id} className="text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <div className="font-medium line-clamp-1">{c.productName}</div>
                  <div className="text-xs text-muted-foreground flex justify-between mt-0.5">
                    <span>Qty {c.targetQty}</span>
                    <span>{c.completedAt ? new Date(c.completedAt).toLocaleString() : ""}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
