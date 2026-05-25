import React, { useState, useMemo } from "react";
import {
  useListBoms,
  useListWorkloadCards,
  useCreateBom,
  useUpdateBom,
  useAssembleItem,
  useListProducts,
  getListBomsQueryKey,
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Factory, Plus, Trash2, Loader2, PackageCheck, AlertCircle, CheckCircle2, Pencil, Package, Search, X,
} from "lucide-react";

export default function Manufacturing() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manufacturing</h1>
        <p className="text-muted-foreground mt-2">
          Define recipes and assemble finished products from raw materials.
        </p>
      </div>

      <Tabs defaultValue="bom" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="bom" data-testid="tab-bom">Bill of Material</TabsTrigger>
          <TabsTrigger value="assemble" data-testid="tab-assemble">Assemble Item</TabsTrigger>
        </TabsList>

        <TabsContent value="bom" className="mt-6">
          <BomTab />
        </TabsContent>

        <TabsContent value="assemble" className="mt-6">
          <AssembleTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ----------------------------- BOM TAB -----------------------------

function BomTab() {
  const { data: boms, isLoading } = useListBoms();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBom, setEditingBom] = useState<any | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)} data-testid="button-create-bom">
          <Plus className="w-4 h-4 mr-2" /> Create BOM
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : !boms || boms.length === 0 ? (
          <div className="col-span-full text-center py-12 border border-dashed rounded-lg">
            <Factory className="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-4" />
            <h3 className="text-lg font-medium">No BOMs found</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              A Bill of Material defines which raw materials and quantities go into one batch of a finished product.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create First BOM
            </Button>
          </div>
        ) : (
          boms.map((bom: any) => (
            <Card key={bom.id} data-testid={`bom-card-${bom.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg line-clamp-1">{bom.finishedProductName}</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      Output: {bom.outputQuantity} per batch
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 -mt-1 -mr-2"
                    onClick={() => setEditingBom(bom)}
                    data-testid={`button-edit-bom-${bom.id}`}
                    title="Edit BOM"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs font-semibold mb-2 uppercase text-muted-foreground">
                  Materials Required
                </div>
                <ul className="space-y-2 text-sm">
                  {bom.items.slice(0, 5).map((item: any) => (
                    <li key={item.id} className="flex justify-between border-b border-border/50 pb-1 last:border-0">
                      <span className="line-clamp-1">{item.materialProductName}</span>
                      <span className="font-medium ml-4 shrink-0 tabular-nums">
                        {item.quantity} {item.unit}
                      </span>
                    </li>
                  ))}
                  {bom.items.length > 5 && (
                    <li className="text-xs text-center text-muted-foreground pt-1">
                      +{bom.items.length - 5} more items
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <BomDialog
        mode="create"
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
      <BomDialog
        mode="edit"
        bom={editingBom}
        open={editingBom != null}
        onOpenChange={(v) => { if (!v) setEditingBom(null); }}
      />
    </div>
  );
}

// --------------------------- ASSEMBLE TAB ---------------------------

function AssembleTab() {
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

// --------------------------- CREATE BOM DIALOG ---------------------------

type MaterialRow = { materialProductId: string; quantity: string; unit: string };

function BomDialog({
  mode,
  bom,
  open,
  onOpenChange,
}: {
  mode: "create" | "edit";
  bom?: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createBom = useCreateBom();
  const updateBom = useUpdateBom();

  const { data: finishedProducts } = useListProducts({ forManufacturing: true });
  const { data: allProducts } = useListProducts({});

  const isEdit = mode === "edit";
  const pending = createBom.isPending || updateBom.isPending;

  const [finishedProductId, setFinishedProductId] = useState("");
  const [outputQuantity, setOutputQuantity] = useState("1");
  const [items, setItems] = useState<MaterialRow[]>([
    { materialProductId: "", quantity: "", unit: "" },
  ]);

  React.useEffect(() => {
    if (!open) return;
    if (isEdit && bom) {
      setFinishedProductId(String(bom.finishedProductId));
      setOutputQuantity(String(bom.outputQuantity));
      setItems(
        (bom.items ?? []).length > 0
          ? bom.items.map((it: any) => ({
              materialProductId: String(it.materialProductId),
              quantity: String(it.quantity),
              unit: it.unit ?? "",
            }))
          : [{ materialProductId: "", quantity: "", unit: "" }],
      );
    } else if (!isEdit) {
      setFinishedProductId("");
      setOutputQuantity("1");
      setItems([{ materialProductId: "", quantity: "", unit: "" }]);
    }
  }, [open, isEdit, bom]);

  const reset = () => {
    setFinishedProductId(""); setOutputQuantity("1");
    setItems([{ materialProductId: "", quantity: "", unit: "" }]);
  };
  const handleClose = () => { onOpenChange(false); if (!isEdit) reset(); };

  const updateItem = (i: number, patch: Partial<MaterialRow>) => {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };
  const addItemRow = () => setItems((prev) => [...prev, { materialProductId: "", quantity: "", unit: "" }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const onPickMaterial = (i: number, productId: string) => {
    const prod = allProducts?.find((p: any) => String(p.id) === productId);
    updateItem(i, { materialProductId: productId, unit: prod?.unit ?? "" });
  };

  const handleSave = () => {
    if (!finishedProductId) {
      toast({ title: "Pick a finished product", variant: "destructive" });
      return;
    }
    const validItems = items.filter(it => it.materialProductId && Number(it.quantity) > 0 && it.unit);
    if (validItems.length === 0) {
      toast({ title: "Add at least one material", description: "Each material needs product, quantity and unit.", variant: "destructive" });
      return;
    }
    const mappedItems = validItems.map(it => ({
      materialProductId: Number(it.materialProductId),
      quantity: Number(it.quantity),
      unit: it.unit.trim(),
    }));

    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListBomsQueryKey() });
      toast({ title: isEdit ? "BOM updated" : "BOM created" });
      handleClose();
    };
    const onError = async (err: any) => {
      let desc = err?.message ?? "Server error";
      try {
        const body = err?.response ? await err.response.json() : null;
        if (body?.error) desc = String(body.error).slice(0, 300);
      } catch {}
      toast({
        title: isEdit ? "Failed to update BOM" : "Failed to create BOM",
        description: desc,
        variant: "destructive",
      });
    };

    if (isEdit && bom) {
      updateBom.mutate(
        {
          id: bom.id,
          data: {
            outputQuantity: Number(outputQuantity) || 1,
            items: mappedItems,
          },
        },
        { onSuccess, onError },
      );
    } else {
      createBom.mutate(
        {
          data: {
            finishedProductId: Number(finishedProductId),
            outputQuantity: Number(outputQuantity) || 1,
            items: mappedItems,
          },
        },
        { onSuccess, onError },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit BOM (Recipe)" : "Create BOM (Recipe)"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the output quantity or the materials required per batch. The finished product cannot be changed."
              : <>Define which raw materials &amp; quantities are required to produce one batch of a finished product. Only products marked <strong>Add for Manufacturing</strong> appear in the finished product list.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Finished Product *</Label>
              {isEdit ? (
                <Input
                  value={bom?.finishedProductName ?? ""}
                  disabled
                  data-testid="input-finished-product-locked"
                />
              ) : (
                <Select value={finishedProductId} onValueChange={setFinishedProductId}>
                  <SelectTrigger data-testid="select-finished-product">
                    <SelectValue placeholder="Choose product to manufacture..." />
                  </SelectTrigger>
                  <SelectContent>
                    {!finishedProducts || finishedProducts.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-muted-foreground">
                        No products marked for manufacturing. Edit a product and turn on <strong>Add for Manufacturing</strong>.
                      </div>
                    ) : (
                      finishedProducts.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} <span className="text-muted-foreground text-xs ml-2">({p.itemCode})</span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Output per Batch *</Label>
              <Input
                type="number" min="0" step="0.001"
                value={outputQuantity}
                onChange={(e) => setOutputQuantity(e.target.value)}
                data-testid="input-output-quantity"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base">Required Materials</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItemRow}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Material
              </Button>
            </div>
            <div className="rounded-lg border divide-y">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 p-2 items-end">
                  <div className="col-span-6 space-y-1">
                    {i === 0 && <Label className="text-xs text-muted-foreground">Material</Label>}
                    <Select value={it.materialProductId} onValueChange={(v) => onPickMaterial(i, v)}>
                      <SelectTrigger data-testid={`select-material-${i}`}>
                        <SelectValue placeholder="Pick material..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allProducts?.map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                            <span className="text-muted-foreground text-xs ml-2">
                              {p.notForSale ? "(raw)" : p.addForManufacturing ? "(mfg)" : ""}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3 space-y-1">
                    {i === 0 && <Label className="text-xs text-muted-foreground">Quantity</Label>}
                    <Input
                      type="number" min="0" step="0.001"
                      value={it.quantity}
                      onChange={(e) => updateItem(i, { quantity: e.target.value })}
                      placeholder="0"
                      data-testid={`input-qty-${i}`}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {i === 0 && <Label className="text-xs text-muted-foreground">Unit</Label>}
                    <Input
                      value={it.unit}
                      onChange={(e) => updateItem(i, { unit: e.target.value })}
                      placeholder="L, kg, pcs"
                      data-testid={`input-unit-${i}`}
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button" variant="ghost" size="icon"
                      onClick={() => removeItem(i)}
                      disabled={items.length === 1}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: mark raw materials as <strong>Not for Sale</strong> in Inventory so they stay out of the price catalog.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={pending}>Cancel</Button>
          <Button onClick={handleSave} disabled={pending} data-testid="button-save-bom">
            {pending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {isEdit ? "Save Changes" : "Create BOM"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
