import React, { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useListInvoices, InvoiceInvoiceType } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function Invoices() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  
  const isSalesman = user?.role === "salesman";

  const { data: invoices, isLoading } = useListInvoices({
    search: search || undefined,
    type: type !== "all" ? type as any : undefined,
    salesmanId: isSalesman ? user?.id : undefined
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
      </div>

      <div className="flex gap-4 mb-4">
        <Input 
          placeholder="Search invoice number or customer..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Invoice Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="gst">GST</SelectItem>
            <SelectItem value="non_gst">Non-GST</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : invoices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">No invoices found.</TableCell>
                </TableRow>
              ) : (
                invoices?.map(invoice => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNo}</TableCell>
                    <TableCell>{format(new Date(invoice.invoiceDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{invoice.invoiceType === "gst" ? "GST" : "Non-GST"}</Badge>
                    </TableCell>
                    <TableCell>{invoice.customerName || "Cash Sale"}</TableCell>
                    <TableCell className="text-right font-bold">₹{invoice.grandTotal.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === "saved" ? "default" : invoice.status === "draft" ? "secondary" : "destructive"}>
                        {invoice.status}
                      </Badge>
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
