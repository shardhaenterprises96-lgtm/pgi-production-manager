import React, { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import {
  useListInvoices,
  useDeleteInvoice,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Pencil, Trash2, Loader2, UserCircle2, Eye } from "lucide-react";

export default function Invoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [deleting, setDeleting] = useState<{ id: number; invoiceNo: string; invoiceType: string } | null>(null);

  const isSalesman = user?.role === "salesman";
  const isAdmin = user?.role === "admin";

  // Salesman scoping is enforced server-side from their session entity — no need
  // (and incorrect) to send user.id here, which is the user-account id, not the
  // entity id referenced by invoices.salesman_id.
  const { data: invoices, isLoading } = useListInvoices({
    search: search || undefined,
    type: type !== "all" ? (type as any) : undefined,
  });

  const deleteInvoice = useDeleteInvoice();

  const handleConfirmDelete = () => {
    if (!deleting) return;
    deleteInvoice.mutate(
      { id: deleting.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
          toast({
            title: "Invoice cancelled",
            description:
              deleting.invoiceType === "gst"
                ? `${deleting.invoiceNo} cancelled. Stock reversed.`
                : `${deleting.invoiceNo} cancelled. Stock NOT reversed (non-GST policy).`,
          });
          setDeleting(null);
        },
        onError: async (err: any) => {
          let msg = err?.message ?? "Delete failed";
          try { const j = await err?.response?.json?.(); if (j?.error) msg = String(j.error).slice(0, 300); } catch {}
          toast({ title: "Delete failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
      </div>

      <div className="flex gap-4 mb-4">
        <Input
          placeholder="Search invoice number or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="input-invoice-search"
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
                {isAdmin && <TableHead>Created By</TableHead>}
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : invoices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8">No invoices found.</TableCell>
                </TableRow>
              ) : (
                invoices?.map((invoice) => {
                  const bySalesman = isAdmin && !!invoice.salesmanName;
                  return (
                  <TableRow
                    key={invoice.id}
                    data-testid={`row-invoice-${invoice.id}`}
                    className={bySalesman ? "bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/30 border-l-2 border-l-amber-500" : undefined}
                  >
                    <TableCell className={bySalesman ? "font-mono font-semibold italic text-amber-900 dark:text-amber-200" : "font-medium"}>
                      {invoice.invoiceNo}
                    </TableCell>
                    <TableCell>{format(new Date(invoice.invoiceDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{invoice.invoiceType === "gst" ? "GST" : "Non-GST"}</Badge>
                    </TableCell>
                    <TableCell>{invoice.customerName || "Cash Sale"}</TableCell>
                    {isAdmin && (
                      <TableCell data-testid={`cell-created-by-${invoice.id}`}>
                        {invoice.salesmanName ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold italic text-amber-700 dark:text-amber-300">
                            <UserCircle2 className="h-3.5 w-3.5" />
                            {invoice.salesmanName}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Admin / Counter</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-bold">₹{invoice.grandTotal.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === "saved" ? "default" : invoice.status === "draft" ? "secondary" : "destructive"}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setLocation(`/invoices/${invoice.id}`)}
                          data-testid={`button-view-invoice-${invoice.id}`}
                          aria-label="View invoice"
                          title="View invoice"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={invoice.status === "cancelled"}
                              onClick={() => setLocation(`/billing?edit=${invoice.id}`)}
                              data-testid={`button-edit-invoice-${invoice.id}`}
                              aria-label="Edit invoice"
                              title="Edit invoice — opens full editor"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={invoice.status === "cancelled"}
                              onClick={() =>
                                setDeleting({
                                  id: invoice.id,
                                  invoiceNo: invoice.invoiceNo,
                                  invoiceType: invoice.invoiceType,
                                })
                              }
                              data-testid={`button-delete-invoice-${invoice.id}`}
                              aria-label="Cancel invoice"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel invoice {deleting?.invoiceNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.invoiceType === "gst"
                ? "This GST invoice will be marked Cancelled and the line-item stock will be reversed back to inventory."
                : "This non-GST invoice will be marked Cancelled. Stock will NOT be reversed (per business policy) and the action will be written to the audit log."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInvoice.isPending}>Keep Invoice</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }}
              disabled={deleteInvoice.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-invoice"
            >
              {deleteInvoice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, cancel invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
