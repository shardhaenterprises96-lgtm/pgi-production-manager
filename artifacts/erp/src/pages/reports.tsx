import React, { useState } from "react";
import { useGetAuditLog, useGetLedgerReport, useListEntities } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Badge, Download } from "lucide-react";

export default function Reports() {
  const [entityId, setEntityId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data: entities } = useListEntities({});
  const { data: auditLogs, isLoading: logsLoading } = useGetAuditLog();
  const { data: ledgerReport, isLoading: ledgerLoading } = useGetLedgerReport({
    entityId: entityId !== "all" ? parseInt(entityId) : undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
  }, { query: { enabled: true } }); // Mocking

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Reports & Ledgers</h1>
      </div>

      <Tabs defaultValue="ledger" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="ledger">Ledger Export</TabsTrigger>
          <TabsTrigger value="audit">System Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate Ledger Report</CardTitle>
              <CardDescription>Filter transactions by entity and date range.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end mb-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Entity</label>
                  <Select value={entityId} onValueChange={setEntityId}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Select Entity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Entities</SelectItem>
                      {entities?.map(e => (
                        <SelectItem key={e.id} value={e.id.toString()}>{e.name} ({e.type})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">From Date</label>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">To Date</label>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
                <Button variant="outline"><Download className="w-4 h-4 mr-2" /> Export CSV</Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Select filters to generate report.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>System Audit Trail</CardTitle>
              <CardDescription>Chronological record of system activities.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
                  ) : auditLogs?.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No audit logs found.</TableCell></TableRow>
                  ) : (
                    auditLogs?.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">{format(new Date(log.createdAt), "MMM dd, yyyy HH:mm:ss")}</TableCell>
                        <TableCell className="font-medium">{log.userName}</TableCell>
                        <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{log.description}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
