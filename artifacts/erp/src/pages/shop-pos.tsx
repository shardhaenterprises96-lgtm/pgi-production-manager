import React, { useMemo, useState } from "react";
import {
  useListLocations,
  useListShopInventory,
  useCreatePosSale,
  useListPosSales,
  useGetPosDailySummary,
  getListShopInventoryQueryKey,
  getListPosSalesQueryKey,
  getGetPosDailySummaryQueryKey,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, Plus, Trash2, Search, IndianRupee, Package } from "lucide-react";

type Line = { productId: number; productName: string; unit: string; available: number; qty: number; rate: number };

export default function ShopPosPage() {
  const { user } = useAuth();
  const { data: locations } = useListLocations();
  const shops = useMemo(() => (locations ?? []).filter((l: any) => l.type === "shop"), [locations]);
  const [locationId, setLocationId] = useState<number>(user?.locationId ?? shops[0]?.id ?? 2);
  React.useEffect(() => {
    if (user?.locationId) setLocationId(user.locationId);
    else if (!locationId && shops.length) setLocationId(shops[0].id);
  }, [user?.locationId, shops.length]);

  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: inventory } = useListShopInventory({ locationId } as any);
  const { data: todaySales } = useListPosSales({ locationId } as any);
  const { data: summary } = useGetPosDailySummary({ locationId } as any);
  const createSale = useCreatePosSale();

  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState({ name: "", mobile: "" });
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "credit">("cash");
  const [discount, setDiscount] = useState("0");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (inventory ?? []).filter((r: any) => Number(r.currentStock) > 0);
    if (!q) return list.slice(0, 24);
    return list
      .filter((r: any) => r.productName.toLowerCase().includes(q) || r.itemCode.toLowerCase().includes(q))
      .slice(0, 24);
  }, [inventory, search]);

  const addLine = (row: any) => {
    setLines((cur) => {
      const idx = cur.findIndex((l) => l.productId === row.productId);
      if (idx >= 0) {
        const copy = [...cur];
        if (copy[idx].qty < row.currentStock) copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...cur, {
        productId: row.productId,
        productName: row.productName,
        unit: row.unit,
        available: Number(row.currentStock),
        qty: 1,
        rate: Number(row.shopRetailPrice ?? 0) || 0,
      }];
    });
  };

  const subtotal = lines.reduce((s, l) => s + l.qty * l.rate, 0);
  const disc = Number(discount) || 0;
  const total = Math.max(0, subtotal - disc);

  const reset = () => {
    setLines([]); setCustomer({ name: "", mobile: "" }); setPaymentMode("cash"); setDiscount("0");
  };

  const handleSave = async () => {
    if (lines.length === 0) { toast({ title: "Add at least one item", variant: "destructive" }); return; }
    const bad = lines.find((l) => l.rate <= 0 || l.qty <= 0);
    if (bad) { toast({ title: `Set qty & rate for ${bad.productName}`, variant: "destructive" }); return; }
    try {
      const sale = await createSale.mutateAsync({
        data: {
          locationId,
          customerName: customer.name || null,
          customerMobile: customer.mobile || null,
          paymentMode,
          discount: disc,
          items: lines.map((l) => ({ productId: l.productId, qty: l.qty, rate: l.rate })),
        },
      });
      toast({ title: `Bill ${(sale as any).billNo} saved`, description: `₹${Number((sale as any).total).toFixed(2)} · ${paymentMode.toUpperCase()}` });
      reset();
      await qc.invalidateQueries({ queryKey: getListShopInventoryQueryKey({ locationId } as any) });
      await qc.invalidateQueries({ queryKey: getListPosSalesQueryKey({ locationId } as any) });
      await qc.invalidateQueries({ queryKey: getGetPosDailySummaryQueryKey({ locationId } as any) });
    } catch (err: any) {
      toast({ title: "Sale failed", description: err?.message ?? "Server error", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="w-7 h-7" /> Counter POS
          </h1>
          <p className="text-muted-foreground mt-1">Quick-add bills. Stock debits automatically from this shop's inventory.</p>
        </div>
        {shops.length > 1 && (
          <Select value={String(locationId)} onValueChange={(v) => setLocationId(Number(v))}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {shops.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs defaultValue="bill">
        <TabsList>
          <TabsTrigger value="bill">New Bill</TabsTrigger>
          <TabsTrigger value="today">Today's Sales</TabsTrigger>
        </TabsList>

        <TabsContent value="bill" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* LEFT — product picker */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Search product by name / code…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    data-testid="input-pos-search"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filtered.length === 0 ? (
                  <div className="text-muted-foreground text-sm py-8 text-center">No matching products in stock.</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {filtered.map((r: any) => (
                      <button
                        key={r.id}
                        onClick={() => addLine(r)}
                        className="text-left p-3 border rounded-md hover:bg-accent transition-colors flex gap-2 items-start"
                        data-testid={`pos-pick-${r.productId}`}
                      >
                        <div className="w-10 h-10 rounded border bg-muted/30 shrink-0 overflow-hidden flex items-center justify-center">
                          {r.imageUrl ? <img src={r.imageUrl} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{r.productName}</div>
                          <div className="text-xs text-muted-foreground flex items-center justify-between">
                            <span>{Number(r.currentStock).toLocaleString()} {r.unit}</span>
                            <span className="font-semibold text-foreground">₹{Number(r.shopRetailPrice ?? 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* RIGHT — bill */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3"><CardTitle className="text-base">Current Bill</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Customer name" value={customer.name} onChange={(e) => setCustomer((s) => ({ ...s, name: e.target.value }))} />
                  <Input placeholder="Mobile" value={customer.mobile} onChange={(e) => setCustomer((s) => ({ ...s, mobile: e.target.value }))} />
                </div>

                <div className="border rounded-md">
                  {lines.length === 0 ? (
                    <div className="text-muted-foreground text-sm py-8 text-center">Click a product on the left to add</div>
                  ) : (
                    <div className="divide-y">
                      {lines.map((l, i) => (
                        <div key={l.productId} className="p-2 grid grid-cols-12 gap-1 items-center text-sm">
                          <div className="col-span-5 truncate" title={l.productName}>{l.productName}</div>
                          <Input type="number" step="0.001" value={l.qty}
                            onChange={(e) => {
                              const q = Number(e.target.value);
                              setLines((cur) => cur.map((x, j) => j === i ? { ...x, qty: q } : x));
                            }}
                            className="col-span-2 h-7 text-xs" />
                          <Input type="number" step="0.01" value={l.rate}
                            onChange={(e) => {
                              const r = Number(e.target.value);
                              setLines((cur) => cur.map((x, j) => j === i ? { ...x, rate: r } : x));
                            }}
                            className="col-span-3 h-7 text-xs" />
                          <div className="col-span-1 text-right tabular-nums text-xs font-medium">{(l.qty * l.rate).toFixed(0)}</div>
                          <Button size="icon" variant="ghost" className="col-span-1 h-7 w-7"
                            onClick={() => setLines((cur) => cur.filter((_, j) => j !== i))}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">₹{subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between items-center text-sm">
                    <Label>Discount</Label>
                    <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-24 h-7 text-right" />
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-1 border-t"><span>Total</span><span className="tabular-nums">₹{total.toFixed(2)}</span></div>
                </div>

                <div>
                  <Label>Payment Mode</Label>
                  <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="credit">Credit (Khata)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full" size="lg" onClick={handleSave} disabled={createSale.isPending || lines.length === 0} data-testid="button-save-bill">
                  {createSale.isPending ? "Saving…" : `Save & Print — ₹${total.toFixed(2)}`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="today" className="mt-4 space-y-4">
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">Total Sales</div>
                <div className="text-2xl font-bold flex items-center"><IndianRupee className="w-5 h-5" />{Number((summary as any).totalNet).toLocaleString()}</div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">Bills</div>
                <div className="text-2xl font-bold">{(summary as any).billCount}</div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">Discount Given</div>
                <div className="text-2xl font-bold flex items-center"><IndianRupee className="w-5 h-5" />{Number((summary as any).totalDiscount).toLocaleString()}</div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">By Payment</div>
                <div className="text-xs space-y-0.5 mt-1">
                  {((summary as any).byPaymentMode ?? []).map((m: any) => (
                    <div key={m.mode} className="flex justify-between"><span className="capitalize">{m.mode}</span><span className="font-medium">₹{Number(m.total).toFixed(0)} · {m.count}</span></div>
                  ))}
                </div>
              </CardContent></Card>
            </div>
          )}
          <Card>
            <CardHeader><CardTitle className="text-base">Today's Bills</CardTitle></CardHeader>
            <CardContent>
              {((todaySales ?? []) as any[]).length === 0 ? (
                <div className="text-muted-foreground text-sm py-8 text-center">No bills today yet.</div>
              ) : (
                <div className="divide-y">
                  {((todaySales ?? []) as any[]).map((s: any) => (
                    <div key={s.id} className="py-3 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3 font-mono text-xs">{s.billNo}</div>
                      <div className="col-span-3 text-sm">{s.customerName || <span className="text-muted-foreground">Walk-in</span>}</div>
                      <div className="col-span-3 text-xs text-muted-foreground">{s.items.length} item{s.items.length === 1 ? "" : "s"} · {new Date(s.createdAt).toLocaleTimeString()}</div>
                      <div className="col-span-1"><Badge variant="outline" className="text-xs capitalize">{s.paymentMode}</Badge></div>
                      <div className="col-span-2 text-right font-semibold tabular-nums">₹{Number(s.total).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
