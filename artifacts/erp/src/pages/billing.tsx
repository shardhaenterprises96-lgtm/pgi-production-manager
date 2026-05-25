import React, { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Trash2, Printer, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Billing() {
  const [invoiceType, setInvoiceType] = useState<"gst" | "non_gst">("gst");
  const [items, setItems] = useState<any[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Billing & POS</h1>
        <div className="flex gap-2">
          <Button variant="outline"><Save className="w-4 h-4 mr-2"/> Save Draft</Button>
          <Button><Printer className="w-4 h-4 mr-2"/> Print Invoice</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Invoice Details</CardTitle>
              <Select value={invoiceType} onValueChange={(v: "gst" | "non_gst") => setInvoiceType(v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gst">GST Invoice</SelectItem>
                  <SelectItem value="non_gst">Non-GST Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="Search Customer (Mobile or Name)" />
              <Input type="date" />
            </div>

            <div className="border rounded-md mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No items added yet. Search products to add.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹0.00</span>
            </div>
            {invoiceType === "gst" && (
              <>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>CGST</span>
                  <span>₹0.00</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>SGST</span>
                  <span>₹0.00</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-bold text-lg pt-4 border-t">
              <span>Grand Total</span>
              <span>₹0.00</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
