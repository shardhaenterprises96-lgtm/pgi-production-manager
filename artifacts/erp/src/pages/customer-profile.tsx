import React from "react";
import { useParams, Link } from "wouter";
import { useGetEntityLedger, useGetEntity, useListRewardProgress } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, FileText, CreditCard } from "lucide-react";
import { format } from "date-fns";

export default function CustomerProfile() {
  const { id } = useParams();
  const entityId = parseInt(id || "0", 10);
  
  const { data: entityData, isLoading: entityLoading } = useGetEntity(entityId, { 
    query: { enabled: !!entityId, queryKey: ['entity', entityId] } 
  });
  
  const { data: ledger, isLoading: ledgerLoading } = useGetEntityLedger(entityId, { 
    query: { enabled: !!entityId, queryKey: ['ledger', entityId] } 
  });

  const { data: rewards } = useListRewardProgress({ customerId: entityId }, {
    query: { enabled: !!entityId, queryKey: ['rewards', entityId] }
  });

  if (entityLoading || ledgerLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading profile...</div>;
  }

  if (!entityData) {
    return <div className="p-8 text-center text-destructive">Entity not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/customers">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{entityData.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className="capitalize">{entityData.type}</Badge>
            <span className="text-muted-foreground text-sm">{entityData.mobile}</span>
            {entityData.gstin && <Badge variant="outline">GST: {entityData.gstin}</Badge>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Khata Ledger</CardTitle>
              <CardDescription>Transaction history and running balance</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Outstanding Balance</div>
              <div className={`text-2xl font-bold ${ledger?.outstandingBalance && ledger.outstandingBalance > 0 ? "text-destructive" : "text-green-600"}`}>
                ₹{Math.abs(ledger?.outstandingBalance || 0).toLocaleString()}
                {ledger?.outstandingBalance && ledger.outstandingBalance > 0 ? " Dr" : " Cr"}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Ref No</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger?.entries?.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(entry.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {entry.type === 'invoice' ? <FileText className="h-3 w-3 text-muted-foreground" /> : 
                         entry.type === 'payment' ? <CreditCard className="h-3 w-3 text-muted-foreground" /> : null}
                        {entry.description}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{entry.referenceNo || '-'}</TableCell>
                    <TableCell className="text-right text-destructive">
                      {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{Math.abs(entry.balance).toLocaleString()} {entry.balance > 0 ? 'Dr' : 'Cr'}
                    </TableCell>
                  </TableRow>
                ))}
                {(!ledger?.entries || ledger.entries.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transactions found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-y-2">
                <div className="text-muted-foreground">Address</div>
                <div className="text-right">{entityData.address || '-'}</div>
                
                <div className="text-muted-foreground">City/State</div>
                <div className="text-right">{(entityData.city || entityData.state) ? `${entityData.city}, ${entityData.state}` : '-'}</div>
                
                <div className="text-muted-foreground">Pricing Tier</div>
                <div className="text-right capitalize">{entityData.pricingTier || '-'}</div>
                
                <div className="text-muted-foreground">Credit Limit</div>
                <div className="text-right">₹{entityData.creditLimit?.toLocaleString() || 'N/A'}</div>
              </div>
            </CardContent>
          </Card>

          {entityData.type === 'customer' && (
            <Card>
              <CardHeader>
                <CardTitle>Reward Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {rewards?.length ? rewards.map(reward => (
                  <div key={reward.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium line-clamp-1">{reward.productName}</span>
                      <span className="text-muted-foreground">{reward.litersAchieved} / {reward.targetLiters}L</span>
                    </div>
                    <Progress value={reward.progressPct || 0} className={reward.isRewardAchieved ? "[&>div]:bg-green-500" : "[&>div]:bg-primary"} />
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Reward: {reward.rewardValue}</span>
                      {reward.isRewardAchieved && !reward.isDisbursed && (
                        <Badge className="bg-green-500 hover:bg-green-600 text-[10px] py-0 px-1 border-transparent text-white">Achieved!</Badge>
                      )}
                      {reward.isDisbursed && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1 border-transparent">Disbursed</Badge>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="text-center text-muted-foreground text-sm">No active reward schemes.</div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
