import React, { useMemo, useState } from "react";
import {
  useListLocations,
  useListStockTransfers,
  useDispatchStockTransfer,
  useReceiveStockTransfer,
  getListStockTransfersQueryKey,
  getListShopInventoryQueryKey,
  getListProductsQueryKey,
  getGetLowStockAlertsQueryKey,
  getListWorkloadCardsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeftRight, Truck, PackageCheck, Loader2 } from "lucide-react";

const STATUS_VARIANT: Record<string, any> = {
  requested: "secondary",
  dispatched: "default",
  received: "outline",
  cancelled: "destructive",
};

export default function ShopTransfersPage() {
  const { user } = useAuth();
  const { data: locations } = useListLocations();
  const shops = useMemo(() => (locations ?? []).filter((l: any) => l.type === "shop"), [locations]);
  const isShop = user?.role === "shop";
  const [filter, setFilter] = useState<string>(user?.locationId ? String(user.locationId) : "all");

  const params: any = filter === "all" ? {} : { locationId: Number(filter) };
  const { data: transfers, isLoading } = useListStockTransfers(params);
  const dispatch = useDispatchStockTransfer();
  const receive = useReceiveStockTransfer();
  const qc = useQueryClient();
  const { toast } = useToast();

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: getListStockTransfersQueryKey() });
    await qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
    await qc.invalidateQueries({ queryKey: getGetLowStockAlertsQueryKey() });
    await qc.invalidateQueries({ queryKey: getListWorkloadCardsQueryKey() });
    for (const s of shops) {
      await qc.invalidateQueries({ queryKey: getListShopInventoryQueryKey({ locationId: s.id } as any) });
    }
  };

  const handleDispatch = async (id: number) => {
    try {
      await dispatch.mutateAsync({ id } as any);
      toast({ title: "Dispatched — factory stock debited" });
      await refresh();
    } catch (err: any) {
      toast({ title: "Failed", description: err?.message ?? "Server error", variant: "destructive" });
    }
  };

  const handleReceive = async (id: number) => {
    try {
      await receive.mutateAsync({ id } as any);
      toast({ title: "Received — shop stock credited" });
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
            <ArrowLeftRight className="w-7 h-7" /> Stock Transfers
          </h1>
          <p className="text-muted-foreground mt-1">
            Factory → Shop transfers. Shop requests, Factory dispatches, Shop receives.
          </p>
        </div>
        {!isShop && (
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {(locations ?? []).map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Transfers ({(transfers ?? []).length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground text-sm py-8 text-center">Loading…</div>
          ) : (transfers ?? []).length === 0 ? (
            <div className="text-muted-foreground text-sm py-8 text-center">No transfers yet. Shop can request from Shop Inventory page.</div>
          ) : (
            <div className="space-y-3">
              {(transfers ?? []).map((t: any) => (
                <div key={t.id} className="border rounded-md p-4" data-testid={`transfer-${t.id}`}>
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div>
                      <div className="font-mono text-sm font-semibold">{t.transferNo}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t.fromLocationName} → {t.toLocationName} · {new Date(t.createdAt).toLocaleString()}
                      </div>
                      {t.linkedWorkloadCardId && (
                        <div className="text-xs text-amber-600 mt-1">→ Manufacturing workload card #{t.linkedWorkloadCardId} created</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[t.status] ?? "secondary"} className="capitalize">{t.status}</Badge>
                      {t.status === "requested" && !isShop && (
                        <Button size="sm" onClick={() => handleDispatch(t.id)} disabled={dispatch.isPending} data-testid={`button-dispatch-${t.id}`}>
                          {dispatch.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Truck className="w-3.5 h-3.5 mr-1" />}
                          Dispatch
                        </Button>
                      )}
                      {t.status === "dispatched" && (isShop || user?.role === "admin") && (
                        <Button size="sm" onClick={() => handleReceive(t.id)} disabled={receive.isPending} className="bg-green-600 hover:bg-green-700 text-white" data-testid={`button-receive-${t.id}`}>
                          {receive.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5 mr-1" />}
                          Receive
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="border-t pt-2">
                    <div className="grid grid-cols-12 gap-2 text-xs uppercase text-muted-foreground font-medium pb-1">
                      <div className="col-span-6">Product</div>
                      <div className="col-span-2 text-right">Requested</div>
                      <div className="col-span-2 text-right">Dispatched</div>
                      <div className="col-span-2 text-right">Received</div>
                    </div>
                    <div className="divide-y">
                      {t.items.map((it: any) => (
                        <div key={it.id} className="grid grid-cols-12 gap-2 py-1.5 text-sm items-center">
                          <div className="col-span-6 truncate">{it.productName}</div>
                          <div className="col-span-2 text-right tabular-nums">{Number(it.requestedQty).toLocaleString()} {it.unit}</div>
                          <div className="col-span-2 text-right tabular-nums">{Number(it.dispatchedQty).toLocaleString()}</div>
                          <div className="col-span-2 text-right tabular-nums">{Number(it.receivedQty).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {t.notes && <div className="text-xs text-muted-foreground mt-2 italic">Note: {t.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
