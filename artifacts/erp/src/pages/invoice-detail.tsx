import { useRoute, useLocation } from "wouter";
import { useGetInvoice, getGetInvoiceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Printer, Loader2, UserCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/use-auth";

const inr = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoiceDetail() {
  const [, params] = useRoute("/invoices/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const id = Number(params?.id);
  const { data: invoice, isLoading, error } = useGetInvoice(id, {
    query: {
      enabled: Number.isFinite(id),
      queryKey: getGetInvoiceQueryKey(id),
    },
  });

  if (isLoading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !invoice) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">Invoice not found or you do not have access to view it.</p>
            <Button variant="outline" onClick={() => setLocation("/invoices")}>
              <ArrowLeft className="h-4 w-4 mr-2" />Back to invoices
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isGst = invoice.invoiceType === "gst";
  const isInterstate = (invoice.placeOfSupply ?? "Maharashtra") !== "Maharashtra";
  const isAdmin = user?.role === "admin";

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto print:p-0 print:max-w-none">
      {/* Top toolbar (hidden in print) */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="outline" onClick={() => setLocation("/invoices")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />Back to invoices
        </Button>
        <div className="flex items-center gap-2">
          {isAdmin && invoice.status !== "cancelled" && (
            <Button variant="outline" onClick={() => setLocation(`/billing?edit=${invoice.id}`)} data-testid="button-edit">
              Edit
            </Button>
          )}
          <Button onClick={() => window.print()} data-testid="button-print">
            <Printer className="h-4 w-4 mr-2" />Print
          </Button>
        </div>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Shradha Oil Center</h2>
              <p className="text-sm text-muted-foreground">Vipro Brand — Lubricating Oils & Greases</p>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {isGst ? "Tax Invoice" : "Cash Memo"}
              </div>
              <div className="text-xl font-mono font-bold mt-1">{invoice.invoiceNo}</div>
              <div className="mt-2 flex items-center gap-2 justify-end">
                <Badge variant={isGst ? "default" : "secondary"}>{isGst ? "GST" : "Non-GST"}</Badge>
                <Badge variant={invoice.status === "saved" ? "default" : invoice.status === "cancelled" ? "destructive" : "secondary"}>
                  {invoice.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Field label="Invoice Date" value={format(new Date(invoice.invoiceDate), "dd MMM yyyy")} />
            {invoice.dueDate && (
              <Field label="Due Date" value={format(new Date(invoice.dueDate), "dd MMM yyyy")} />
            )}
            <Field label="Place of Supply" value={invoice.placeOfSupply ?? "—"} />
            {invoice.poNumber && <Field label="PO Number" value={invoice.poNumber} />}
            {invoice.eWayBillNo && <Field label="E-Way Bill" value={invoice.eWayBillNo} />}
            {invoice.salesmanName && (
              <Field
                label="Created By"
                value={
                  <span className="inline-flex items-center gap-1 italic text-amber-700 dark:text-amber-300">
                    <UserCircle2 className="h-3.5 w-3.5" />
                    {invoice.salesmanName}
                  </span>
                }
              />
            )}
          </div>

          {/* Customer block */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border rounded-md p-4 bg-muted/30">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Bill To</div>
              <div className="font-semibold">{invoice.customerName || "Cash Sale"}</div>
              {invoice.customerGstin && (
                <div className="text-sm text-muted-foreground">GSTIN: <span className="font-mono">{invoice.customerGstin}</span></div>
              )}
              {invoice.billingAddress && (
                <div className="text-sm whitespace-pre-line mt-1">{invoice.billingAddress}</div>
              )}
            </div>
            {invoice.shippingAddress && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Ship To</div>
                <div className="text-sm whitespace-pre-line">{invoice.shippingAddress}</div>
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Item</TableHead>
                  {isGst && <TableHead className="w-24">HSN</TableHead>}
                  <TableHead className="text-right w-20">Qty</TableHead>
                  <TableHead className="w-16">Unit</TableHead>
                  <TableHead className="text-right w-24">Rate</TableHead>
                  {invoice.items?.some(i => (i.discountPct ?? 0) > 0 || (i.discountAmt ?? 0) > 0) && (
                    <TableHead className="text-right w-20">Disc</TableHead>
                  )}
                  {isGst && <TableHead className="text-right w-16">Tax%</TableHead>}
                  <TableHead className="text-right w-28">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items?.map((item, idx) => (
                  <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    {isGst && <TableCell className="font-mono text-xs">{item.hsnCode ?? "—"}</TableCell>}
                    <TableCell className="text-right">{item.qty}</TableCell>
                    <TableCell className="text-xs uppercase">{item.unit}</TableCell>
                    <TableCell className="text-right">₹{inr(item.rate)}</TableCell>
                    {invoice.items?.some(i => (i.discountPct ?? 0) > 0 || (i.discountAmt ?? 0) > 0) && (
                      <TableCell className="text-right text-muted-foreground">
                        {(item.discountPct ?? 0) > 0
                          ? `${item.discountPct}%`
                          : (item.discountAmt ?? 0) > 0
                          ? `₹${inr(item.discountAmt!)}`
                          : "—"}
                      </TableCell>
                    )}
                    {isGst && <TableCell className="text-right">{item.taxPct ?? 0}%</TableCell>}
                    <TableCell className="text-right font-semibold">₹{inr(item.amount)}</TableCell>
                  </TableRow>
                ))}
                {(!invoice.items || invoice.items.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No line items</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full md:w-80 space-y-1.5 text-sm">
              <TotalRow label="Subtotal" value={invoice.subtotal} />
              {(invoice.totalDiscount ?? 0) > 0 && (
                <TotalRow label="Discount" value={-(invoice.totalDiscount ?? 0)} />
              )}
              {isGst && !isInterstate && (
                <>
                  <TotalRow label="CGST" value={invoice.cgst ?? 0} />
                  <TotalRow label="SGST" value={invoice.sgst ?? 0} />
                </>
              )}
              {isGst && isInterstate && <TotalRow label="IGST" value={invoice.igst ?? 0} />}
              {(invoice.freight ?? 0) > 0 && <TotalRow label="Freight" value={invoice.freight ?? 0} />}
              {(invoice.roundOff ?? 0) !== 0 && <TotalRow label="Round Off" value={invoice.roundOff ?? 0} />}
              <div className="border-t pt-2 mt-2">
                <TotalRow label="Grand Total" value={invoice.grandTotal} emphasis />
              </div>
              {(invoice.amountPaid ?? 0) > 0 && (
                <>
                  <TotalRow label="Paid" value={invoice.amountPaid ?? 0} />
                  <TotalRow label="Balance Due" value={invoice.balanceDue ?? 0} emphasis />
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t pt-4 text-xs text-muted-foreground flex justify-between">
            <span>
              Generated {invoice.createdAt ? format(new Date(invoice.createdAt), "dd MMM yyyy, HH:mm") : ""}
            </span>
            <span>Thank you for your business.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function TotalRow({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className={`flex justify-between ${emphasis ? "text-base font-bold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">₹{inr(value)}</span>
    </div>
  );
}
