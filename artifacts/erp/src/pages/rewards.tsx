import React, { useState } from "react";
import { useAuth } from "@/contexts/use-auth";
import { useListRewardSchemes, useListRewardProgress, useDisburseReward, useCreateRewardScheme } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gift, CheckCircle, Award } from "lucide-react";
import { format } from "date-fns";

export default function Rewards() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(["admin"]);
  
  const { data: schemes, isLoading: schemesLoading } = useListRewardSchemes();
  const { data: progress, isLoading: progressLoading } = useListRewardProgress({});
  const disburse = useDisburseReward();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Volume Rewards</h1>
          <p className="text-muted-foreground mt-2">Manage customer reward schemes and performance.</p>
        </div>
        {isAdmin && <Button><Plus className="w-4 h-4 mr-2"/> New Scheme</Button>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Reward Progress</CardTitle>
          <CardDescription>Track volume targets and disburse rewards.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Scheme / Product</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {progressLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow>
              ) : progress?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No active progress.</TableCell></TableRow>
              ) : (
                progress?.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.customerName}</TableCell>
                    <TableCell>{p.productName}</TableCell>
                    <TableCell className="w-[300px]">
                      <div className="flex justify-between text-xs mb-1">
                        <span>{p.litersAchieved} L</span>
                        <span>{p.targetLiters} L</span>
                      </div>
                      <Progress value={p.progressPct || 0} className={p.isRewardAchieved ? "[&>div]:bg-green-500" : ""} />
                    </TableCell>
                    <TableCell>
                      {p.isDisbursed ? (
                        <Badge variant="secondary">Disbursed</Badge>
                      ) : p.isRewardAchieved ? (
                        <Badge className="bg-green-500 text-white animate-pulse"><Award className="w-3 h-3 mr-1"/> Achieved</Badge>
                      ) : (
                        <Badge variant="outline">In Progress</Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        {p.isRewardAchieved && !p.isDisbursed && (
                          <Button size="sm" onClick={() => disburse.mutate({ data: { progressId: p.id } })}>
                            <Gift className="w-4 h-4 mr-1"/> Settle
                          </Button>
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

function Plus(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M5 12h14"/><path d="M12 5v14"/></svg>;
}
