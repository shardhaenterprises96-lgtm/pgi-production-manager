import React, { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import {
  useListInvoices,
  useUpdateInvoice,
  useDeleteInvoice,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Pencil, Trash2, Loader2 } from "lucide-react";

type EditState = {
  id: number;
  invoiceNo: string;
  status: "draft" | "saved" | "cancelled";
  dueDate: string;
};

export default function Invoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [deleting, setDeleting] = useState<{ id: number; invoiceNo: string; invoiceType: string } | null>(null);

  const isSalesman = user?.role === "salesman";
  const isAdmin = user?.role === "admin";

  const { data: invoices, isLoading } = useListInvoices({
    search: search || undefined,
    type: type !== "all" ? (type as any) : undefined,
    salesmanId: isSalesman ? user?.id : undefined,
  });

  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();

  const handleSaveEdit = () => {
    if (!editing) return;
    updateInvoice.mutate(
      {
        id: editing.id,
        data: {
          status: editing.status,
          dueDate: editing.dueDate || "",
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
          toast({ title: "Invoice updated", description: `${editing.invoiceNo} saved.` });
          setEditing(null);
        },
        onError: async (err: any) => {
          let msg = err?.message ?? "Update failed";
          try { const j = await err?.response?.json?.(); if (j?.error) msg = String(j.error).slice(0, 300); } catch {}
          toast({ title: "Update failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

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
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="text-right w-32">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : invoices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8">No invoices found.</TableCell>
                </TableRow>
              ) : (
                invoices?.map((invoice) => (
                  <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
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
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setEditing({
                                id: invoice.id,
                                invoiceNo: invoice.invoiceNo,
                                status: invoice.status as any,
                                dueDate: (invoice as any).dueDate ? String((invoice as any).dueDate).slice(0, 10) : "",
                              })
                            }
                            data-testid={`button-edit-invoice-${invoice.id}`}
                            aria-label="Edit invoice"
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
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Invoice {editing?.invoiceNo}</DialogTitle>
            <DialogDescription>
              Update invoice status and due date. Line items, totals and stock are immutable —
              cancel and re-create the invoice if those need to change.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editing.status}
                  onValueChange={(v) => setEditing({ ...editing, status: v as any })}
                >
                  <SelectTrigger id="edit-status" data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="saved">Saved</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  To cancel an invoice, close this dialog and use the trash icon — that runs the stock
                  reversal (GST) or audit (non-GST) workflow.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-due-date">Due Date</Label>
                <Input
                  id="edit-due-date"
                  type="date"
                  value={editing.dueDate}
                  onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })}
                  data-testid="input-edit-due-date"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={updateInvoice.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateInvoice.isPending} data-testid="button-save-edit-invoice">
              {updateInvoice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
