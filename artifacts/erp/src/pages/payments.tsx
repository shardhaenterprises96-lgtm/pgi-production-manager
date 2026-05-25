import React, { useState } from "react";
import { useAuth } from "@/contexts/use-auth";
import { useListPayments, useApprovePayment, useRejectPayment, PaymentStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { CheckCircle2, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Payments() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(["admin"]);
  const [status, setStatus] = useState<PaymentStatus | "all">("all");
  
  const queryClient = useQueryClient();
  const approvePayment = useApprovePayment();
  const rejectPayment = useRejectPayment();

  const { data: payments, isLoading } = useListPayments({
    status: status !== "all" ? status as PaymentStatus : undefined
  });

  const handleApprove = (id: number) => {
    approvePayment.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
      }
    });
  };

  const handleReject = (id: number) => {
    rejectPayment.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments & Receipts</h1>
          <p className="text-muted-foreground mt-2">Manage incoming payments and escrow approvals.</p>
        </div>
        <Button>Log Payment</Button>
      </div>

      <div className="flex gap-4">
        <Select value={status} onValueChange={(v) => setStatus(v as PaymentStatus | "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="pending">Pending Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Collected By</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : payments?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-muted-foreground">No payments found.</TableCell>
                </TableRow>
              ) : (
                payments?.map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-xs">{payment.receiptId || `REC-${payment.id}`}</TableCell>
                    <TableCell>{format(new Date(payment.createdAt), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="font-medium">{payment.customerName}</TableCell>
                    <TableCell>{payment.salesmanName || "Direct"}</TableCell>
                    <TableCell className="capitalize">{payment.mode.replace('_', ' ')}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">₹{payment.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={
                        payment.status === "approved" ? "default" : 
                        payment.status === "rejected" ? "destructive" : 
                        "secondary"
                      } className={payment.status === "approved" ? "bg-green-500" : payment.status === "pending" ? "bg-amber-500 text-white" : ""}>
                        {payment.status}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        {payment.status === "pending" && (
                          <div className="flex justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-green-600 border-green-600 hover:bg-green-50"
                              onClick={() => handleApprove(payment.id)}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-destructive border-destructive hover:bg-destructive/10"
                              onClick={() => handleReject(payment.id)}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
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
