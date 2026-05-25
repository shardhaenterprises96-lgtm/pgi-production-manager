import { useState, useEffect } from "react";
import {
  useCreateBom,
  useUpdateBom,
  getListBomsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";

export interface BomDraftItem {
  materialProductId: string;
  quantity: string;
  unit: string;
}

export interface BomDialogState {
  finishedProductId: number;
  finishedProductName: string;
  existingBom: any | null;
}

export function BomDialog({
  state,
  allProducts,
  onClose,
}: {
  state: BomDialogState | null;
  allProducts: any[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createBom = useCreateBom();
  const updateBom = useUpdateBom();

  const [outputQty, setOutputQty] = useState("1");
  const [items, setItems] = useState<BomDraftItem[]>([
    { materialProductId: "", quantity: "", unit: "QTY" },
  ]);

  useEffect(() => {
    if (!state) return;
    if (state.existingBom) {
      setOutputQty(String(state.existingBom.outputQuantity ?? "1"));
      setItems(
        (state.existingBom.items ?? []).map((it: any) => ({
          materialProductId: String(it.materialProductId),
          quantity: String(it.quantity),
          unit: it.unit ?? "QTY",
        })),
      );
    } else {
      setOutputQty("1");
      setItems([{ materialProductId: "", quantity: "", unit: "QTY" }]);
    }
  }, [state]);

  if (!state) return null;

  const candidates = allProducts.filter((p: any) => p.id !== state.finishedProductId);
  const submitting = createBom.isPending || updateBom.isPending;

  const addRow = () => setItems((rows) => [...rows, { materialProductId: "", quantity: "", unit: "QTY" }]);
  const removeRow = (idx: number) => setItems((rows) => rows.filter((_, i) => i !== idx));
  const updateRow = (idx: number, patch: Partial<BomDraftItem>) =>
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const validItems = items.filter(
    (i) => i.materialProductId && Number(i.quantity) > 0,
  );
  const dupSet = new Set<string>();
  const hasDuplicate = validItems.some((i) => {
    if (dupSet.has(i.materialProductId)) return true;
    dupSet.add(i.materialProductId);
    return false;
  });
  const outputQtyNum = Number(outputQty);
  const canSave =
    !submitting &&
    outputQtyNum > 0 &&
    validItems.length > 0 &&
    !hasDuplicate;

  async function handleSave() {
    if (!state) return;
    const payload = {
      outputQuantity: outputQtyNum,
      items: validItems.map((i) => ({
        materialProductId: Number(i.materialProductId),
        quantity: Number(i.quantity),
        unit: i.unit || "QTY",
      })),
    };
    try {
      if (state.existingBom) {
        await updateBom.mutateAsync({ id: state.existingBom.id, data: payload });
        toast({ title: "BOM updated", description: `Recipe for ${state.finishedProductName} saved.` });
      } else {
        await createBom.mutateAsync({
          data: { finishedProductId: state.finishedProductId, ...payload },
        });
        toast({ title: "BOM created", description: `Recipe for ${state.finishedProductName} saved.` });
      }
      await queryClient.invalidateQueries({ queryKey: getListBomsQueryKey() });
      onClose();
    } catch (err: any) {
      toast({
        title: "Could not save BOM",
        description: err?.response?.data?.error ?? err?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={!!state} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {state.existingBom ? "Edit BOM" : "Add BOM"} — {state.finishedProductName}
          </DialogTitle>
          <DialogDescription>
            Define how many units this recipe produces and the raw materials consumed per batch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_160px] gap-3 items-end">
            <div>
              <Label>Finished Product</Label>
              <Input value={state.finishedProductName} disabled className="mt-1.5" />
            </div>
            <div>
              <Label>Output Qty / batch</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={outputQty}
                onChange={(e) => setOutputQty(e.target.value)}
                className="mt-1.5"
                data-testid="input-bom-output-qty"
              />
            </div>
          </div>

          <div className="border rounded-md">
            <div className="grid grid-cols-[1fr_120px_100px_40px] gap-2 px-3 py-2 text-xs uppercase text-muted-foreground font-medium border-b bg-muted/50">
              <div>Material</div>
              <div className="text-right">Qty / batch</div>
              <div>Unit</div>
              <div></div>
            </div>
            <div className="divide-y">
              {items.map((row, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_120px_100px_40px] gap-2 px-3 py-2 items-center">
                  <Select
                    value={row.materialProductId}
                    onValueChange={(v) => {
                      const prod = candidates.find((p: any) => String(p.id) === v);
                      updateRow(idx, {
                        materialProductId: v,
                        unit: row.unit || prod?.unit || "QTY",
                      });
                    }}
                  >
                    <SelectTrigger data-testid={`select-material-${idx}`}>
                      <SelectValue placeholder="Select material…" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}{p.itemCode ? ` · ${p.itemCode}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    value={row.quantity}
                    onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                    className="text-right"
                    data-testid={`input-material-qty-${idx}`}
                  />
                  <Input
                    value={row.unit}
                    onChange={(e) => updateRow(idx, { unit: e.target.value })}
                    placeholder="QTY"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeRow(idx)}
                    disabled={items.length === 1}
                    title="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="p-2 border-t">
              <Button variant="outline" size="sm" onClick={addRow} data-testid="button-add-material">
                <Plus className="h-3.5 w-3.5 mr-1" />Add material
              </Button>
            </div>
          </div>

          {hasDuplicate && (
            <p className="text-xs text-destructive">Each material can appear only once.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave} data-testid="button-save-bom">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {state.existingBom ? "Update BOM" : "Create BOM"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
