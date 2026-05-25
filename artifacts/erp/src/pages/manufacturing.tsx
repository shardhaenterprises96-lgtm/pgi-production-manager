import React, { useState } from "react";
import {
  useListBoms,
  useListWorkloadCards,
  useCreateBom,
  useListProducts,
  getListBomsQueryKey,
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
  Clock, PlayCircle, CheckCircle2, Factory, Plus, Trash2, Loader2,
} from "lucide-react";

export default function Manufacturing() {
  const { data: boms, isLoading: bomsLoading } = useListBoms();
  const { data: workloads } = useListWorkloadCards();
  const [bomDialogOpen, setBomDialogOpen] = useState(false);

  const pendingCards = workloads?.filter(c => c.status === "pending") || [];
  const processingCards = workloads?.filter(c => c.status === "processing") || [];
  const doneCards = workloads?.filter(c => c.status === "done") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manufacturing Station</h1>
          <p className="text-muted-foreground mt-2">Manage BOMs (recipes) and production pipeline.</p>
        </div>
      </div>

      <Tabs defaultValue="pipeline" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pipeline">Production Pipeline</TabsTrigger>
          <TabsTrigger value="boms">BOM Master (Recipes)</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PipelineColumn title="Pending" icon={<Clock className="h-4 w-4 text-amber-500" />} cards={pendingCards} empty="No pending tasks" />
            <PipelineColumn title="Processing" icon={<PlayCircle className="h-4 w-4 text-blue-500" />} cards={processingCards} empty="No active processing" />
            <PipelineColumn title="Done" icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} cards={doneCards} empty="No completed tasks" />
          </div>
        </TabsContent>

        <TabsContent value="boms" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setBomDialogOpen(true)} data-testid="button-create-bom">
              <Plus className="w-4 h-4 mr-2" /> Create BOM (Recipe)
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bomsLoading ? (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </div>
            ) : !boms || boms.length === 0 ? (
              <div className="col-span-3 text-center py-12 border border-dashed rounded-lg">
                <Factory className="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                <h3 className="text-lg font-medium">No BOMs found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a Bill of Materials to define what raw materials go into each finished product.
                </p>
                <Button onClick={() => setBomDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Create First BOM
                </Button>
              </div>
            ) : (
              boms.map((bom: any) => (
                <Card key={bom.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg line-clamp-1">{bom.finishedProductName}</CardTitle>
                    <div className="text-sm text-muted-foreground">Output: {bom.outputQuantity} units per batch</div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs font-semibold mb-2 uppercase text-muted-foreground">Materials Required</div>
                    <ul className="space-y-2 text-sm">
                      {bom.items.slice(0, 5).map((item: any) => (
                        <li key={item.id} className="flex justify-between border-b border-border/50 pb-1 last:border-0">
                          <span className="line-clamp-1">{item.materialProductName}</span>
                          <span className="font-medium ml-4 shrink-0 tabular-nums">{item.quantity} {item.unit}</span>
                        </li>
                      ))}
                      {bom.items.length > 5 && (
                        <li className="text-xs text-center text-muted-foreground pt-1">+{bom.items.length - 5} more items</li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <CreateBomDialog open={bomDialogOpen} onOpenChange={setBomDialogOpen} />
    </div>
  );
}

function PipelineColumn({ title, icon, cards, empty }: { title: string; icon: React.ReactNode; cards: any[]; empty: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="font-semibold flex items-center gap-2">{icon} {title}</h3>
        <Badge variant="secondary">{cards.length}</Badge>
      </div>
      <div className="space-y-3">
        {cards.map(card => <WorkloadCardUI key={card.id} card={card} />)}
        {cards.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">{empty}</div>}
      </div>
    </div>
  );
}

function WorkloadCardUI({ card }: { card: any }) {
  return (
    <Card className="shadow-sm border-border/60 hover:border-border transition-colors">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="font-mono text-[10px] text-muted-foreground">#{card.id}</div>
          <Badge variant="outline" className="text-[10px] uppercase">{card.orderType?.replace('_', ' ')}</Badge>
        </div>
        <h4 className="font-semibold text-sm leading-tight mb-3 line-clamp-2">{card.productName}</h4>
        <div className="flex justify-between items-end mt-4">
          <div className="text-2xl font-bold text-primary">
            {card.targetQty} <span className="text-xs font-normal text-muted-foreground">units</span>
          </div>
          {card.status === "pending" && <Button size="sm" variant="secondary" className="h-7 text-xs">Start</Button>}
          {card.status === "processing" && <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white">Complete</Button>}
        </div>
      </CardContent>
    </Card>
  );
}

type MaterialRow = { materialProductId: string; quantity: string; unit: string };

function CreateBomDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createBom = useCreateBom();

  // Finished products: only those flagged for manufacturing
  const { data: finishedProducts } = useListProducts({ forManufacturing: true });
  // Materials: all products (raw materials are typically "not for sale" / internal items)
  const { data: allProducts } = useListProducts({});

  const [finishedProductId, setFinishedProductId] = useState("");
  const [outputQuantity, setOutputQuantity] = useState("1");
  const [items, setItems] = useState<MaterialRow[]>([
    { materialProductId: "", quantity: "", unit: "" },
  ]);

  const reset = () => {
    setFinishedProductId(""); setOutputQuantity("1");
    setItems([{ materialProductId: "", quantity: "", unit: "" }]);
  };
  const handleClose = () => { onOpenChange(false); reset(); };

  const updateItem = (i: number, patch: Partial<MaterialRow>) => {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };
  const addItemRow = () => setItems((prev) => [...prev, { materialProductId: "", quantity: "", unit: "" }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  // When material is picked, auto-fill its unit
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
    createBom.mutate(
      {
        data: {
          finishedProductId: Number(finishedProductId),
          outputQuantity: Number(outputQuantity) || 1,
          items: validItems.map(it => ({
            materialProductId: Number(it.materialProductId),
            quantity: Number(it.quantity),
            unit: it.unit.trim(),
          })),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBomsQueryKey() });
          toast({ title: "BOM created" });
          handleClose();
        },
        onError: async (err: any) => {
          let desc = err?.message ?? "Server error";
          try {
            const body = err?.response ? await err.response.json() : null;
            if (body?.error) desc = String(body.error).slice(0, 300);
          } catch {}
          console.error("BOM create error", err);
          toast({ title: "Failed to create BOM", description: desc, variant: "destructive" });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create BOM (Recipe)</DialogTitle>
          <DialogDescription>
            Define which raw materials &amp; quantities are required to produce one batch of a finished product.
            Only products marked <strong>Add for Manufacturing</strong> appear in the finished product list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Finished Product *</Label>
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
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={createBom.isPending} data-testid="button-save-bom">
            {createBom.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Create BOM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
