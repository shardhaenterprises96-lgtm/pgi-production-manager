import React, { useState } from "react";
import { useListEntities, useCreateEntity, EntityType } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Search, UserPlus } from "lucide-react";

export default function Customers() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<EntityType>("customer");

  const { data: entities, isLoading } = useListEntities({
    type: type !== "all" ? type as EntityType : undefined,
    search: search || undefined
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Entity Directory</h1>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" /> Add Entity
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search name or mobile..." 
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={type} onValueChange={(v) => setType(v as EntityType)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Entity Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">Customers</SelectItem>
            <SelectItem value="vendor">Vendors</SelectItem>
            <SelectItem value="worker">Workers</SelectItem>
            <SelectItem value="salesman">Salesmen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Pricing Tier</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : entities?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No entities found.</TableCell>
                </TableRow>
              ) : (
                entities?.map(entity => (
                  <TableRow key={entity.id}>
                    <TableCell className="font-medium">
                      <Link href={`/customers/${entity.id}`} className="text-primary hover:underline">
                        {entity.name}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">{entity.type}</TableCell>
                    <TableCell>{entity.mobile}</TableCell>
                    <TableCell>
                      {entity.pricingTier && <Badge variant="outline" className="capitalize">{entity.pricingTier}</Badge>}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      <span className={entity.outstandingBalance && entity.outstandingBalance > 0 ? "text-destructive" : "text-green-600"}>
                        ₹{Math.abs(entity.outstandingBalance || 0).toLocaleString()}
                        {entity.outstandingBalance && entity.outstandingBalance > 0 ? " Dr" : " Cr"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/customers/${entity.id}`}>
                        <Button variant="ghost" size="sm">View Ledger</Button>
                      </Link>
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
