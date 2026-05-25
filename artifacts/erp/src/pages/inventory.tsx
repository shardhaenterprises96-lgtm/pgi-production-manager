import React, { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useListProducts, useCreateProduct, ProductInputPricingBasis } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, PackageSearch, PackagePlus } from "lucide-react";
import { Label } from "@/components/ui/label";

export default function Inventory() {
  const [search, setSearch] = useState("");
  const { data: products, isLoading } = useListProducts({ search: search || undefined });
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
        <AddProductDialog />
      </div>

      <div className="flex gap-4">
        <div className="relative w-full max-w-sm">
          <PackageSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name or code..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Pricing (W/R)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : products?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No products found.</TableCell>
                </TableRow>
              ) : (
                products?.map(product => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-xs">{product.itemCode}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.brand}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={product.currentStock <= (product.minStockThreshold || 0) ? "text-destructive font-bold" : ""}>
                          {product.currentStock} {product.unit}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      ₹{product.wholesalePrice} / ₹{product.retailPrice}
                    </TableCell>
                    <TableCell>
                      {product.notForSale ? (
                        <Badge variant="secondary">Internal</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600">Active</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AddProductDialog() {
  const [open, setOpen] = useState(false);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PackagePlus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Product Details</TabsTrigger>
            <TabsTrigger value="pricing">Price & Margin</TabsTrigger>
            <TabsTrigger value="stock">Stock Config</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input placeholder="Enter product name" />
              </div>
              <div className="space-y-2">
                <Label>Item Code</Label>
                <Input placeholder="Unique code" />
              </div>
              <div className="space-y-2">
                <Label>Brand</Label>
                <Input placeholder="e.g. Vipro" />
              </div>
              <div className="space-y-2">
                <Label>Group</Label>
                <Input placeholder="e.g. Engine Oil" />
              </div>
              <div className="space-y-2">
                <Label>Unit of Measure</Label>
                <Input placeholder="e.g. Ltr, Box, Pcs" />
              </div>
              <div className="space-y-2">
                <Label>Liters per Box</Label>
                <Input type="number" placeholder="Volume multiplier" />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={() => document.querySelector('[data-value="pricing"]')?.dispatchEvent(new MouseEvent('click', {bubbles:true}))}>Next</Button>
            </div>
          </TabsContent>
          
          <TabsContent value="pricing" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Purchase Price</Label>
                <Input type="number" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>MRP</Label>
                <Input type="number" placeholder="0.00" />
              </div>
              <div className="col-span-2 p-4 bg-muted/50 rounded-lg space-y-4 border">
                <h4 className="font-medium">Selling Prices</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Wholesale Price (B2B)</Label>
                    <Input type="number" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Retail Price</Label>
                    <Input type="number" placeholder="0.00" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>HSN Code</Label>
                <Input placeholder="Tariff code" />
              </div>
              <div className="space-y-2">
                <Label>Tax Rate (%)</Label>
                <Input type="number" placeholder="18" />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={() => document.querySelector('[data-value="stock"]')?.dispatchEvent(new MouseEvent('click', {bubbles:true}))}>Next</Button>
            </div>
          </TabsContent>
          
          <TabsContent value="stock" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Opening Stock</Label>
                <Input type="number" placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Min Stock Threshold</Label>
                <Input type="number" placeholder="Alert level" />
              </div>
            </div>
            <div className="flex justify-end pt-4 gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => setOpen(false)}>Save Product</Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
