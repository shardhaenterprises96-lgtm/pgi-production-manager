import React, { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useListProducts, useListProductGroups, useListBrands } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Minus, ShoppingCart } from "lucide-react";

export default function Catalog() {
  const { user, hasRole } = useAuth();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<string>("");
  const [brand, setBrand] = useState<string>("");
  
  const { data: products, isLoading } = useListProducts({ 
    search: search || undefined,
    group: group || undefined,
    brand: brand || undefined,
    forSale: true
  });
  
  const { data: groups } = useListProductGroups();
  const { data: brands } = useListBrands();

  const [cart, setCart] = useState<Record<number, number>>({});

  const addToCart = (productId: number) => {
    setCart(prev => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[productId] > 1) {
        newCart[productId] -= 1;
      } else {
        delete newCart[productId];
      }
      return newCart;
    });
  };

  const isB2B = user?.role === "customer";
  const staffRole = hasRole(["admin", "salesman", "store", "manufacturing", "accountant"]);

  const getPrice = (product: any) => {
    if (isB2B) {
      return product.retailPrice; // Default logic, can be customized based on pricing tier
    }
    return `W: ₹${product.wholesalePrice} / R: ₹${product.retailPrice}`;
  };

  const getStockIndicator = (stock: number) => {
    if (stock > 10) return <Badge className="bg-green-500 text-white border-transparent">In Stock</Badge>;
    if (stock > 0) return <Badge variant="outline" className="text-amber-500 border-amber-500">Only {stock} Left!</Badge>;
    return <Badge variant="destructive">Out of Stock</Badge>;
  };

  return (
    <div className="flex h-[calc(100vh-theme(spacing.20))] gap-6">
      <div className="flex-1 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Product Catalog</h1>
        </div>

        <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groups?.map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Brands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands?.map(b => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 pb-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="animate-pulse h-[300px]"></Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products?.map(product => (
                <Card key={product.id} className="flex flex-col overflow-hidden transition-all hover:shadow-md border-border/50">
                  <div className="aspect-square bg-muted flex items-center justify-center relative p-4">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="object-contain h-full w-full" />
                    ) : (
                      <div className="w-20 h-20 opacity-20"><ShoppingCart className="w-full h-full" /></div>
                    )}
                    <div className="absolute top-2 right-2">
                      {getStockIndicator(product.currentStock)}
                    </div>
                  </div>
                  <CardContent className="flex-1 p-4 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 font-mono">{product.itemCode}</div>
                      <h3 className="font-semibold text-base leading-tight mb-2 line-clamp-2">{product.name}</h3>
                      <div className="flex flex-wrap gap-1 mb-2">
                        <Badge variant="secondary" className="text-[10px]">{product.brand}</Badge>
                        <Badge variant="outline" className="text-[10px]">{product.group}</Badge>
                      </div>
                    </div>
                    <div className="mt-2 text-primary font-bold text-lg">
                      {isB2B ? `₹${product.retailPrice}` : (
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground font-normal">W: ₹{product.wholesalePrice}</span>
                          <span className="text-sm">R: ₹{product.retailPrice}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 pt-0 border-t border-border/20 bg-muted/10 mt-auto">
                    {cart[product.id] ? (
                      <div className="flex items-center justify-between w-full mt-4">
                        <Button size="icon" variant="outline" onClick={() => removeFromCart(product.id)}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="font-bold">{cart[product.id]}</span>
                        <Button size="icon" onClick={() => addToCart(product.id)} disabled={cart[product.id] >= product.currentStock}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        className="w-full mt-4" 
                        onClick={() => addToCart(product.id)}
                        disabled={product.currentStock <= 0}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Add to Cart
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-80 bg-card border rounded-lg shadow-sm flex flex-col shrink-0 overflow-hidden sticky top-6 self-start max-h-[calc(100vh-theme(spacing.12))]">
        <div className="p-4 border-b bg-muted/30 font-semibold flex items-center justify-between">
          <span>Order Summary</span>
          <Badge variant="secondary">{Object.values(cart).reduce((a, b) => a + b, 0)} Items</Badge>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.entries(cart).length === 0 ? (
            <div className="text-center text-muted-foreground text-sm mt-10 flex flex-col items-center">
              <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
              Your cart is empty
            </div>
          ) : (
            Object.entries(cart).map(([id, qty]) => {
              const product = products?.find(p => p.id === Number(id));
              if (!product) return null;
              return (
                <div key={id} className="flex justify-between text-sm">
                  <div className="flex-1 pr-4">
                    <p className="font-medium line-clamp-1">{product.name}</p>
                    <p className="text-muted-foreground">{qty} x {isB2B ? product.retailPrice : product.wholesalePrice}</p>
                  </div>
                  <div className="font-bold shrink-0">
                    ₹{(qty * (isB2B ? product.retailPrice : product.wholesalePrice)).toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="p-4 border-t bg-muted/10 space-y-4">
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-primary">
              ₹{Object.entries(cart).reduce((total, [id, qty]) => {
                const product = products?.find(p => p.id === Number(id));
                return total + (qty * (product ? (isB2B ? product.retailPrice : product.wholesalePrice) : 0));
              }, 0).toLocaleString()}
            </span>
          </div>
          <Button className="w-full" disabled={Object.keys(cart).length === 0} onClick={() => {
            // Forward to billing or place order
            if (staffRole) {
              window.location.href = `/billing?cart=${encodeURIComponent(JSON.stringify(cart))}`;
            } else {
              // B2B direct place order logic
              alert("Order placement coming soon");
            }
          }}>
            {staffRole ? "Proceed to Billing" : "Place Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}
