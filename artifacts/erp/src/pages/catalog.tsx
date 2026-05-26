import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/use-auth";
import {
  useListProducts,
  useListProductGroups,
  useListBrands,
  useLookupEntityByMobile,
  useCreateEntity,
  useCreateCustomerOrder,
  getListCustomerOrdersQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Plus, Minus, ShoppingCart, Phone, User, CheckCircle, UserPlus, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getLookupEntityByMobileQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

type CartItem = { qty: number };

export default function Catalog() {
  const { user, hasRole } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<string>("");
  const [brand, setBrand] = useState<string>("");
  const [cart, setCart] = useState<Record<number, CartItem>>({});

  // Customer lookup dialog state
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [mobileInput, setMobileInput] = useState("");
  const [searchMobile, setSearchMobile] = useState("");
  const [step, setStep] = useState<"mobile" | "not_found" | "found">("mobile");
  const [foundCustomer, setFoundCustomer] = useState<any>(null);

  const { data: products, isLoading } = useListProducts({
    search: search || undefined,
    group: group || undefined,
    brand: brand || undefined,
    forSale: true,
  });
  const { data: groups } = useListProductGroups();
  const { data: brands } = useListBrands();

  const isB2B = user?.role === "customer";
  const { toast } = useToast();
  const placeOrder = useCreateCustomerOrder();

  const handlePlaceOrder = () => {
    const items = Object.entries(cart)
      .map(([id, { qty }]) => ({ productId: Number(id), qty }))
      .filter((i) => i.qty > 0);
    if (items.length === 0) return;
    placeOrder.mutate(
      { data: { items } },
      {
        onSuccess: (order: any) => {
          toast({
            title: "Order placed",
            description: `Your order ${order.orderNo ?? ""} has been submitted.`,
          });
          setCart({});
          queryClient.invalidateQueries({ queryKey: getListCustomerOrdersQueryKey() });
          setLocation("/my-orders");
        },
        onError: (err: any) => {
          toast({
            title: "Failed to place order",
            description: err?.message ?? "Please try again",
            variant: "destructive",
          });
        },
      },
    );
  };
  const isStaff = hasRole(["admin", "salesman", "store", "manufacturing", "accountant"]);

  const totalItems = Object.values(cart).reduce((a, b) => a + b.qty, 0);
  const totalAmount = Object.entries(cart).reduce((total, [id, { qty }]) => {
    const product = products?.find((p) => p.id === Number(id));
    if (!product) return total;
    const price = isB2B ? product.retailPrice : product.wholesalePrice;
    return total + qty * price;
  }, 0);

  const addToCart = (productId: number) => {
    setCart((prev) => ({
      ...prev,
      [productId]: { qty: (prev[productId]?.qty || 0) + 1 },
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => {
      const newCart = { ...prev };
      if (newCart[productId].qty > 1) {
        newCart[productId] = { qty: newCart[productId].qty - 1 };
      } else {
        delete newCart[productId];
      }
      return newCart;
    });
  };

  const getStockBadge = (stock: number) => {
    if (stock > 10) return <Badge className="bg-green-600 text-white border-transparent text-[10px]">In Stock</Badge>;
    if (stock > 0) return <Badge variant="outline" className="text-amber-500 border-amber-500 text-[10px]">Only {stock} Left!</Badge>;
    return <Badge variant="destructive" className="text-[10px]">Out of Stock</Badge>;
  };

  // Lookup hook — only fires when searchMobile is set
  const { data: lookupResult, isFetching: isLooking } = useLookupEntityByMobile(
    { mobile: searchMobile },
    { query: { enabled: searchMobile.length === 10, queryKey: getLookupEntityByMobileQueryKey({ mobile: searchMobile }) } }
  );

  const handleMobileLookup = () => {
    if (mobileInput.length !== 10) return;
    setSearchMobile(mobileInput);
  };

  // When lookup result changes, decide next step
  const handleLookupResult = () => {
    if (!lookupResult) return;
    if (lookupResult.found && lookupResult.entity) {
      setFoundCustomer(lookupResult.entity);
      setStep("found");
    } else {
      setStep("not_found");
    }
  };

  // Watch lookup result
  useState(() => {
    if (lookupResult !== undefined && searchMobile) {
      handleLookupResult();
    }
  });

  // When lookup finishes, auto-advance
  if (lookupResult !== undefined && searchMobile && step === "mobile" && !isLooking) {
    handleLookupResult();
  }

  const proceedToBillingWithCustomer = (customer: any) => {
    const cartParam = encodeURIComponent(JSON.stringify(
      Object.entries(cart).map(([id, { qty }]) => ({ productId: Number(id), qty }))
    ));
    const customerParam = encodeURIComponent(JSON.stringify(customer));
    setLocation(`/billing?cart=${cartParam}&customer=${customerParam}`);
  };

  // New customer form
  const newCustomerForm = useForm({
    defaultValues: {
      name: "",
      mobile: mobileInput,
      gstin: "",
      address: "",
      city: "",
      state: "Maharashtra",
      pricingTier: "retail" as "retail" | "wholesale",
    },
  });

  const createEntity = useCreateEntity();
  const queryClient = useQueryClient();

  const handleCreateCustomer = newCustomerForm.handleSubmit(async (data) => {
    createEntity.mutate(
      { data: { type: "customer", ...data, mobile: mobileInput } },
      {
        onSuccess: (newCustomer) => {
          proceedToBillingWithCustomer(newCustomer);
        },
      }
    );
  });

  const openCustomerDialog = () => {
    setMobileInput("");
    setSearchMobile("");
    setStep("mobile");
    setFoundCustomer(null);
    newCustomerForm.reset({ name: "", mobile: "", gstin: "", address: "", city: "", state: "Maharashtra", pricingTier: "retail" });
    setShowCustomerDialog(true);
  };

  return (
    <div className="flex h-[calc(100vh-theme(spacing.20))] gap-6">
      {/* Products grid */}
      <div className="flex-1 flex flex-col space-y-4 min-w-0">
        <h1 className="text-3xl font-bold tracking-tight">Product Catalog</h1>

        <div className="flex items-center gap-3 bg-card p-4 rounded-lg border shadow-sm flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-products"
            />
          </div>
          <Select value={group} onValueChange={(v) => setGroup(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groups?.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={brand} onValueChange={(v) => setBrand(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Brands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands?.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 pb-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <Card key={i} className="animate-pulse h-[340px]" />)}
            </div>
          ) : products?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
              <p>No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products?.map((product) => (
                <Card
                  key={product.id}
                  data-testid={`card-product-${product.id}`}
                  className="flex flex-col overflow-hidden transition-all hover:shadow-md border-border/50"
                >
                  <div className="aspect-square bg-muted flex items-center justify-center relative p-1 sm:p-2">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="object-contain h-full w-full" />
                    ) : (
                      <div className="w-24 h-24 opacity-10 text-foreground">
                        <ShoppingCart className="w-full h-full" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">{getStockBadge(product.currentStock)}</div>
                  </div>
                  <CardContent className="flex-1 p-3 flex flex-col gap-2">
                    <div className="text-[10px] text-muted-foreground font-mono">{product.itemCode}</div>
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2">{product.name}</h3>
                    {isB2B ? (
                      <div className="text-primary font-bold">₹{product.retailPrice}</div>
                    ) : (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground whitespace-nowrap">
                        <span>W: <span className="text-foreground font-medium">₹{product.wholesalePrice}</span></span>
                        <span className="text-border">|</span>
                        <span>R: <span className="text-foreground font-medium">₹{product.retailPrice}</span></span>
                      </div>
                    )}
                    <div className="mt-auto">
                      {cart[product.id] ? (
                        <div className="flex items-center justify-between w-full gap-2">
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => removeFromCart(product.id)} data-testid={`button-remove-${product.id}`}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="font-bold text-sm w-6 text-center">{cart[product.id].qty}</span>
                          <Button size="icon" className="h-8 w-8" onClick={() => addToCart(product.id)} disabled={cart[product.id].qty >= product.currentStock} data-testid={`button-add-${product.id}`}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className="w-full h-8 text-xs"
                          onClick={() => addToCart(product.id)}
                          disabled={product.currentStock <= 0}
                          data-testid={`button-addcart-${product.id}`}
                        >
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          Add to Cart
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart sidebar */}
      <div className="w-72 bg-card border rounded-lg shadow-sm flex flex-col shrink-0 sticky top-6 self-start max-h-[calc(100vh-3rem)]">
        <div className="p-4 border-b bg-muted/30 font-semibold flex items-center justify-between">
          <span>Cart</span>
          <Badge variant="secondary">{totalItems} items</Badge>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {Object.keys(cart).length === 0 ? (
            <div className="text-center text-muted-foreground text-sm mt-8 flex flex-col items-center">
              <ShoppingCart className="w-10 h-10 mb-3 opacity-20" />
              Cart is empty
            </div>
          ) : (
            Object.entries(cart).map(([id, { qty }]) => {
              const product = products?.find((p) => p.id === Number(id));
              if (!product) return null;
              const price = isB2B ? product.retailPrice : product.wholesalePrice;
              return (
                <div key={id} data-testid={`cart-item-${id}`} className="flex justify-between text-sm gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs line-clamp-1">{product.name}</p>
                    <p className="text-muted-foreground text-xs">{qty} × ₹{price}</p>
                  </div>
                  <div className="font-bold text-xs shrink-0">₹{(qty * price).toLocaleString()}</div>
                </div>
              );
            })
          )}
        </div>
        <div className="p-4 border-t space-y-3 bg-muted/10">
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span className="text-primary">₹{totalAmount.toLocaleString()}</span>
          </div>
          {isStaff ? (
            <Button
              className="w-full"
              disabled={totalItems === 0}
              onClick={openCustomerDialog}
              data-testid="button-proceed-billing"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Proceed to Billing
            </Button>
          ) : (
            <Button
              className="w-full"
              disabled={totalItems === 0 || placeOrder.isPending}
              onClick={handlePlaceOrder}
              data-testid="button-place-order"
            >
              {placeOrder.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4 mr-2" />
              )}
              Place Order
            </Button>
          )}
        </div>
      </div>

      {/* Customer Lookup Dialog */}
      <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
        <DialogContent className="max-w-md">
          {step === "mobile" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-primary" />
                  Customer Mobile Number
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Enter the customer's mobile number to look up their profile or register a new customer.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="mobile-input">Mobile Number</Label>
                  <div className="flex gap-2">
                    <Input
                      id="mobile-input"
                      data-testid="input-customer-mobile"
                      placeholder="10-digit mobile number"
                      value={mobileInput}
                      maxLength={10}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        setMobileInput(v);
                        setSearchMobile("");
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleMobileLookup(); }}
                      className="text-lg tracking-wider font-mono"
                    />
                    <Button
                      onClick={handleMobileLookup}
                      disabled={mobileInput.length !== 10 || isLooking}
                      data-testid="button-lookup-mobile"
                    >
                      {isLooking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                  {mobileInput.length > 0 && mobileInput.length < 10 && (
                    <p className="text-xs text-muted-foreground">{10 - mobileInput.length} more digits needed</p>
                  )}
                </div>
                <Button variant="outline" className="w-full" onClick={() => proceedToBillingWithCustomer(null)}>
                  Skip — Walk-in / Cash Customer
                </Button>
              </div>
            </>
          )}

          {step === "found" && foundCustomer && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  Customer Found
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold text-lg">{foundCustomer.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-3 h-3" />
                    {foundCustomer.mobile}
                  </div>
                  {foundCustomer.gstin && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">GSTIN: </span>
                      <span className="font-mono text-xs">{foundCustomer.gstin}</span>
                    </div>
                  )}
                  {foundCustomer.address && (
                    <div className="text-sm text-muted-foreground line-clamp-2">{foundCustomer.address}{foundCustomer.city ? `, ${foundCustomer.city}` : ""}</div>
                  )}
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">Outstanding Balance</span>
                    <span className={`font-bold ${foundCustomer.outstandingBalance > 0 ? "text-destructive" : "text-green-600"}`}>
                      ₹{Number(foundCustomer.outstandingBalance).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pricing Tier</span>
                    <Badge variant="outline" className="capitalize">{foundCustomer.pricingTier}</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setStep("mobile"); setSearchMobile(""); }}>
                    Change
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => proceedToBillingWithCustomer(foundCustomer)}
                    data-testid="button-confirm-customer"
                  >
                    Proceed to Billing
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === "not_found" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  New Customer — {mobileInput}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <p className="text-sm text-muted-foreground">
                  This mobile number is not registered. Fill in customer details to register and proceed.
                </p>
                <Form {...newCustomerForm}>
                  <form onSubmit={handleCreateCustomer} className="space-y-3">
                    <FormField
                      control={newCustomerForm.control}
                      name="name"
                      rules={{
                        validate: (value) =>
                          newCustomerForm.getValues("pricingTier") === "wholesale" && !value?.trim()
                            ? "Name is required for wholesale customers"
                            : true,
                      }}
                      render={({ field }) => {
                        const isWholesale = newCustomerForm.watch("pricingTier") === "wholesale";
                        return (
                          <FormItem>
                            <FormLabel>
                              Customer Name {isWholesale ? "*" : <span className="text-muted-foreground font-normal">(optional for retail)</span>}
                            </FormLabel>
                            <FormControl>
                              <Input
                                data-testid="input-new-customer-name"
                                placeholder={isWholesale ? "Business name" : "Leave blank for walk-in retail"}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={newCustomerForm.control}
                        name="gstin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>GSTIN</FormLabel>
                            <FormControl>
                              <Input data-testid="input-new-customer-gstin" placeholder="Optional" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={newCustomerForm.control}
                        name="pricingTier"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pricing Tier</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger data-testid="select-pricing-tier">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="retail">Retail</SelectItem>
                                <SelectItem value="wholesale">Wholesale</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={newCustomerForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input data-testid="input-new-customer-address" placeholder="Street address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={newCustomerForm.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input data-testid="input-new-customer-city" placeholder="City" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={newCustomerForm.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input data-testid="input-new-customer-state" placeholder="State" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => { setStep("mobile"); setSearchMobile(""); }}>
                        Back
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={createEntity.isPending}
                        data-testid="button-create-customer"
                      >
                        {createEntity.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                        Register & Bill
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
