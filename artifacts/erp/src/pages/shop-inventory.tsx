import React, { useMemo, useState } from "react";
import {
  useListLocations,
  useListShopInventory,
  useAddShopInventory,
  useUpdateShopInventory,
  useCreateStockTransfer,
  useListProducts,
  getListShopInventoryQueryKey,
  getListShopLowStockQueryKey,
  getListStockTransfersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Store, AlertTriangle, Plus, ArrowUpFromLine, Package, Pencil } from "lucide-react";

export default function ShopInventoryPage() {
  const { user } = useAuth();
  const { data: locations } = useListLocations();
  const shops = useMemo(() => (locations ?? []).filter((l: any) => l.type === "shop"), [locations]);
  const factory = useMemo(() => (locations ?? []).find((l: any) => l.type === "factory"), [locations]);

  const defaultLoc = user?.locationId ?? shops[0]?.id ?? 2;
  const [locationId, setLocationId] = useState<number>(defaultLoc);
  React.useEffect(() => {
    if (user?.locationId) setLocationId(user.locationId);
    else if (!locationId && shops.length) setLocationId(shops[0].id);
  }, [user?.locationId, shops.length]);

  const { data: rows, isLoading } = useListShopInventory({ locationId } as any);
  const { data: products } = useListProducts();
  const qc = useQueryClient();
  const { toast } = useToast();

  const addRow = useAddShopInventory();
  const updateRow = useUpdateShopInventory();
  const createTransfer = useCreateStockTransfer();

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ productId: "", min: "0", sourceType: "factory", price: "" });

  const [editRow, setEditRow] = useState<any>(null);
  const [editForm, setEditForm] = useState({ min: "0", sourceType: "factory", price: "", currentStock: "" });

  const [transferQty, setTransferQty] = useState<Record<number, string>>({});

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: getListShopInventoryQueryKey({ locationId } as any) });
    await qc.invalidateQueries({ queryKey: getListShopLowStockQueryKey({ locationId } as any) });
    await qc.invalidateQueries({ queryKey: getListStockTransfersQueryKey() });
  };

  const existingProductIds = new Set((rows ?? []).map((r: any) => r.productId));
  const addableProducts = (products ?? []).filter((p: any) => !existingProductIds.has(p.id));

  const lowRows = (rows ?? []).filter((r: any) => Number(r.currentStock) <= Number(r.minStockThreshold));

  const handleAdd = async () => {
    if (!addForm.productId) return;
    try {
      await addRow.mutateAsync({
        data: {
          locationId,
          productId: Number(addForm.productId),
          minStockThreshold: Number(addForm.min || 0),
          sourceType: addForm.sourceType as any,
          shopRetailPrice: addForm.price ? Number(addForm.price) : null,
        },
      });
      toast({ title: "Product added to shop catalog" });
      setAddOpen(false);
      setAddForm({ productId: "", min: "0", sourceType: "factory", price: "" });
      await refresh();
    } catch (err: any) {
      toast({ title: "Failed", description: err?.message ?? "Server error", variant: "destructive" });
    }
  };

  const openEdit = (row: any) => {
    setEditRow(row);
    setEditForm({
      min: row.minStockThreshold,
      sourceType: row.sourceType,
      price: row.shopRetailPrice ?? "",
      currentStock: row.currentStock,
    });
  };

  const handleEdit = async () => {
    if (!editRow) return;
    try {
      await updateRow.mutateAsync({
        id: editRow.id,
        data: {
          minStockThreshold: Number(editForm.min || 0),
          sourceType: editForm.sourceType as any,
          shopRetailPrice: editForm.price ? Number(editForm.price) : null,
          currentStock: Number(editForm.currentStock),
        },
      });
      toast({ title: "Updated" });
      setEditRow(null);
      await refresh();
    } catch (err: any) {
      toast({ title: "Failed", description: err?.message ?? "Server error", variant: "destructive" });
    }
  };

  const handleRequestTransfer = async (row: any) => {
    const qty = Number(transferQty[row.id] || 0);
    if (!qty || qty <= 0) {
      toast({ title: "Enter quantity to request", variant: "destructive" }); return;
    }
    if (!factory) { toast({ title: "Factory not found", variant: "destructive" }); return; }
    try {
      await createTransfer.mutateAsync({
        data: {
          fromLocationId: factory.id,
          toLocationId: locationId,
          notes: `Reorder from low-stock`,
          items: [{ productId: row.productId, requestedQty: qty }],
        },
      });
      toast({
        title: "Transfer requested",
        description: row.sourceType === "factory" && row.hasBom
          ? "Factory stock low → workload created for manufacturing."
          : "Factory will dispatch from existing stock.",
      });
      setTransferQty((s) => ({ ...s, [row.id]: "" }));
      await refresh();
    } catch (err: any) {
      toast({ title: "Failed", description: err?.message ?? "Server error", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Store className="w-7 h-7" /> Shop Inventory
          </h1>
          <p className="text-muted-foreground mt-1">
            Stock at your outlet. Low-stock items can be reordered from factory; any item with a BOM
            will auto-create a manufacturing workload card.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {shops.length > 1 && (
            <Select value={String(locationId)} onValueChange={(v) => setLocationId(Number(v))}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {shops.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setAddOpen(true)} data-testid="button-add-product">
            <Plus className="w-4 h-4 mr-1" /> Add product to shop
          </Button>
        </div>
      </div>

      {lowRows.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" /> {lowRows.length} item{lowRows.length === 1 ? "" : "s"} below minimum
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catalog ({(rows ?? []).length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground text-sm">Loading…</div>
          ) : (rows ?? []).length === 0 ? (
            <div className="text-muted-foreground text-sm py-8 text-center">
              No products in this shop's catalog yet. Click "Add product to shop" to start.
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs uppercase text-muted-foreground font-medium bg-muted/50">
                <div className="col-span-4">Product</div>
                <div className="col-span-1 text-right">Stock</div>
                <div className="col-span-1 text-right">Min</div>
                <div className="col-span-1 text-center">Source</div>
                <div className="col-span-1 text-right">Factory</div>
                <div className="col-span-3 text-center">Request from Factory</div>
                <div className="col-span-1 text-center">Edit</div>
              </div>
              <div className="divide-y">
                {(rows ?? []).map((r: any) => {
                  const isLow = Number(r.currentStock) <= Number(r.minStockThreshold);
                  return (
                    <div key={r.id} className="grid grid-cols-12 gap-3 px-4 py-3 items-center" data-testid={`inv-row-${r.id}`}>
                      <div className="col-span-4 min-w-0 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md border bg-muted/30 shrink-0 overflow-hidden flex items-center justify-center">
                          {r.imageUrl
                            ? <img src={r.imageUrl} alt="" className="w-full h-full object-cover" />
                            : <Package className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.productName}</div>
                          <div className="text-xs text-muted-foreground truncate">{r.itemCode} · {r.unit}</div>
                        </div>
                      </div>
                      <div className="col-span-1 text-right tabular-nums">
                        <Badge variant={isLow ? "destructive" : "secondary"}>
                          {Number(r.currentStock).toLocaleString()}
                        </Badge>
                      </div>
                      <div className="col-span-1 text-right tabular-nums text-muted-foreground">
                        {Number(r.minStockThreshold).toLocaleString()}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {r.sourceType === "factory" ? (
                          <Badge variant="outline" className="text-xs">Factory{r.hasBom ? " · BOM" : ""}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Self</Badge>
                        )}
                      </div>
                      <div className="col-span-1 text-right tabular-nums text-xs text-muted-foreground">
                        {Number(r.factoryStock ?? 0).toLocaleString()}
                      </div>
                      <div className="col-span-3 flex justify-center items-center gap-2">
                        <Input
                          type="number"
                          step="0.001"
                          value={transferQty[r.id] ?? ""}
                          placeholder={isLow ? String(Math.max(1, Number(r.minStockThreshold) - Number(r.currentStock))) : "0"}
                          onChange={(e) => setTransferQty((s) => ({ ...s, [r.id]: e.target.value }))}
                          className="w-24 h-8"
                          data-testid={`input-transfer-qty-${r.id}`}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequestTransfer(r)}
                          disabled={createTransfer.isPending}
                          data-testid={`button-request-${r.id}`}
                        >
                          <ArrowUpFromLine className="w-3.5 h-3.5 mr-1" /> Request
                        </Button>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)} data-testid={`button-edit-${r.id}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Product to Shop Catalog</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Product</Label>
              <Select value={addForm.productId} onValueChange={(v) => setAddForm((s) => ({ ...s, productId: v }))}>
                <SelectTrigger><SelectValue placeholder="Pick a product" /></SelectTrigger>
                <SelectContent>
                  {addableProducts.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name} — {p.itemCode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min Threshold</Label>
                <Input type="number" step="0.001" value={addForm.min} onChange={(e) => setAddForm((s) => ({ ...s, min: e.target.value }))} />
              </div>
              <div>
                <Label>Source</Label>
                <Select value={addForm.sourceType} onValueChange={(v) => setAddForm((s) => ({ ...s, sourceType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="factory">Factory (Vipro)</SelectItem>
                    <SelectItem value="self">Self Purchased</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Shop Retail Price (₹) — optional</Label>
              <Input type="number" step="0.01" value={addForm.price} onChange={(e) => setAddForm((s) => ({ ...s, price: e.target.value }))} placeholder="Leave blank to use master retail" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addRow.isPending || !addForm.productId}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editRow} onOpenChange={(v) => !v && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editRow?.productName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Current Stock</Label>
                <Input type="number" step="0.001" value={editForm.currentStock} onChange={(e) => setEditForm((s) => ({ ...s, currentStock: e.target.value }))} />
              </div>
              <div>
                <Label>Min Threshold</Label>
                <Input type="number" step="0.001" value={editForm.min} onChange={(e) => setEditForm((s) => ({ ...s, min: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Source</Label>
                <Select value={editForm.sourceType} onValueChange={(v) => setEditForm((s) => ({ ...s, sourceType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="factory">Factory (Vipro)</SelectItem>
                    <SelectItem value="self">Self Purchased</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Shop Retail Price</Label>
                <Input type="number" step="0.01" value={editForm.price} onChange={(e) => setEditForm((s) => ({ ...s, price: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={updateRow.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
