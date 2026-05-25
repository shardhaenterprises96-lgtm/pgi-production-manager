import React, { useMemo, useState } from "react";
import {
  useListLocations,
  useListShopInventory,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Printer, Search, Package } from "lucide-react";

export default function ShopCatalogPage() {
  const { user } = useAuth();
  const { data: locations } = useListLocations();
  const shops = useMemo(() => (locations ?? []).filter((l: any) => l.type === "shop"), [locations]);
  const [locationId, setLocationId] = useState<number>(user?.locationId ?? shops[0]?.id ?? 2);
  React.useEffect(() => {
    if (user?.locationId) setLocationId(user.locationId);
    else if (!locationId && shops.length) setLocationId(shops[0].id);
  }, [user?.locationId, shops.length]);

  const { data: rows, isLoading } = useListShopInventory({ locationId } as any);
  const [search, setSearch] = useState("");
  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  const [groupBy, setGroupBy] = useState<"none" | "source">("none");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = (rows ?? []) as any[];
    if (q) list = list.filter((r) => r.productName.toLowerCase().includes(q) || r.itemCode.toLowerCase().includes(q));
    if (hideOutOfStock) list = list.filter((r) => Number(r.currentStock) > 0);
    return list;
  }, [rows, search, hideOutOfStock]);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ label: "All Products", items: filtered }];
    const by: Record<string, any[]> = { Factory: [], Self: [] };
    for (const r of filtered) (r.sourceType === "factory" ? by.Factory : by.Self).push(r);
    return Object.entries(by).filter(([, arr]) => arr.length > 0).map(([label, items]) => ({ label, items }));
  }, [filtered, groupBy]);

  const shopName = shops.find((s: any) => s.id === locationId)?.name ?? "Shop";
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      {/* Print-only stylesheet — hides app chrome and the toolbar */}
      <style>{`
        @media print {
          @page { margin: 12mm; }
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex items-start justify-between gap-4 flex-wrap no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-7 h-7" /> Price Catalog
          </h1>
          <p className="text-muted-foreground mt-1">
            Customer-facing price list for {shopName}. Print this for the counter or share with walk-in customers.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {shops.length > 1 && (
            <Select value={String(locationId)} onValueChange={(v) => setLocationId(Number(v))}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {shops.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No grouping</SelectItem>
              <SelectItem value="source">Group by source</SelectItem>
            </SelectContent>
          </Select>
          <Button variant={hideOutOfStock ? "default" : "outline"} size="sm" onClick={() => setHideOutOfStock((v) => !v)}>
            {hideOutOfStock ? "Showing in-stock only" : "Show all"}
          </Button>
          <Button onClick={handlePrint} data-testid="button-print-catalog">
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
        </div>
      </div>

      <Card className="no-print">
        <CardContent className="pt-4 flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search product by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-catalog-search"
          />
          <div className="text-sm text-muted-foreground whitespace-nowrap">{filtered.length} items</div>
        </CardContent>
      </Card>

      {/* Printable area */}
      <div className="print-area space-y-6">
        {/* Letterhead */}
        <div className="text-center border-b pb-4">
          <div className="text-2xl font-bold tracking-wide">SHRADHA OIL CENTER</div>
          <div className="text-sm text-muted-foreground">Vipro Brand — Lubricating Oils & Greases</div>
          <div className="mt-2 text-base font-semibold">Price Catalog · {shopName}</div>
          <div className="text-xs text-muted-foreground">As of {today}</div>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-sm py-12 text-center">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-muted-foreground text-sm py-12 text-center">No products to show.</div>
        ) : (
          groups.map((grp) => (
            <div key={grp.label} className="space-y-2">
              {groupBy !== "none" && (
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                  {grp.label} ({grp.items.length})
                </h2>
              )}
              <div className="rounded-lg border overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs uppercase text-muted-foreground font-medium bg-muted/50">
                  <div className="col-span-1">#</div>
                  <div className="col-span-6">Product</div>
                  <div className="col-span-2">Code</div>
                  <div className="col-span-1 text-center">Unit</div>
                  <div className="col-span-2 text-right">Price (₹)</div>
                </div>
                <div className="divide-y">
                  {grp.items.map((r: any, i: number) => {
                    const inStock = Number(r.currentStock) > 0;
                    const price = Number(r.shopRetailPrice ?? 0);
                    return (
                      <div
                        key={r.id}
                        className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm"
                        data-testid={`catalog-row-${r.productId}`}
                      >
                        <div className="col-span-1 text-muted-foreground tabular-nums">{i + 1}</div>
                        <div className="col-span-6 flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded border bg-muted/30 shrink-0 overflow-hidden flex items-center justify-center">
                            {r.imageUrl
                              ? <img src={r.imageUrl} alt="" className="w-full h-full object-cover" />
                              : <Package className="w-4 h-4 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{r.productName}</div>
                            {!inStock && <div className="text-[11px] text-red-600 no-print">Out of stock</div>}
                          </div>
                        </div>
                        <div className="col-span-2 font-mono text-xs text-muted-foreground truncate">{r.itemCode}</div>
                        <div className="col-span-1 text-center text-xs">
                          <Badge variant="outline" className="text-[10px]">{r.unit}</Badge>
                        </div>
                        <div className="col-span-2 text-right tabular-nums font-semibold">
                          {price > 0 ? `₹ ${price.toFixed(2)}` : <span className="text-muted-foreground text-xs">Ask counter</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))
        )}

        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          Prices inclusive of all taxes unless specified · Subject to change without notice · Thank you for your business
        </div>
      </div>
    </div>
  );
}
