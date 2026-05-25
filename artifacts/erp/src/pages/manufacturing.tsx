import React from "react";
import { useListBoms, useListWorkloadCards, WorkloadCardStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, PlayCircle, CheckCircle2, Factory } from "lucide-react";
import { format } from "date-fns";

export default function Manufacturing() {
  const { data: boms, isLoading: bomsLoading } = useListBoms();
  const { data: workloads, isLoading: workloadsLoading } = useListWorkloadCards();

  const pendingCards = workloads?.filter(c => c.status === "pending") || [];
  const processingCards = workloads?.filter(c => c.status === "processing") || [];
  const doneCards = workloads?.filter(c => c.status === "done") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manufacturing Station</h1>
          <p className="text-muted-foreground mt-2">Manage BOMs and production pipeline.</p>
        </div>
      </div>

      <Tabs defaultValue="pipeline" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pipeline">Production Pipeline</TabsTrigger>
          <TabsTrigger value="boms">BOM Master</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pipeline" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pending Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" /> Pending
                </h3>
                <Badge variant="secondary">{pendingCards.length}</Badge>
              </div>
              <div className="space-y-3">
                {pendingCards.map(card => (
                  <WorkloadCardUI key={card.id} card={card} />
                ))}
                {pendingCards.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">No pending tasks</div>}
              </div>
            </div>

            {/* Processing Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-blue-500" /> Processing
                </h3>
                <Badge variant="secondary">{processingCards.length}</Badge>
              </div>
              <div className="space-y-3">
                {processingCards.map(card => (
                  <WorkloadCardUI key={card.id} card={card} />
                ))}
                {processingCards.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">No active processing</div>}
              </div>
            </div>

            {/* Done Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Done
                </h3>
                <Badge variant="secondary">{doneCards.length}</Badge>
              </div>
              <div className="space-y-3">
                {doneCards.map(card => (
                  <WorkloadCardUI key={card.id} card={card} />
                ))}
                {doneCards.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">No completed tasks</div>}
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="boms" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bomsLoading ? (
              <div>Loading BOMs...</div>
            ) : boms?.length === 0 ? (
              <div className="col-span-3 text-center py-12 border border-dashed rounded-lg">
                <Factory className="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                <h3 className="text-lg font-medium">No BOMs found</h3>
                <p className="text-sm text-muted-foreground mb-4">Create a Bill of Materials to start manufacturing.</p>
                <Button>Create BOM</Button>
              </div>
            ) : (
              boms?.map(bom => (
                <Card key={bom.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg line-clamp-1">{bom.finishedProductName}</CardTitle>
                    <div className="text-sm text-muted-foreground">Output: {bom.outputQuantity} units</div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs font-semibold mb-2 uppercase text-muted-foreground">Materials Required</div>
                    <ul className="space-y-2 text-sm">
                      {bom.items.slice(0, 3).map(item => (
                        <li key={item.id} className="flex justify-between border-b border-border/50 pb-1 last:border-0">
                          <span className="line-clamp-1">{item.materialProductName}</span>
                          <span className="font-medium ml-4 shrink-0">{item.quantity} {item.unit}</span>
                        </li>
                      ))}
                      {bom.items.length > 3 && (
                        <li className="text-xs text-center text-muted-foreground pt-1">+{bom.items.length - 3} more items</li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WorkloadCardUI({ card }: { card: any }) {
  return (
    <Card className="shadow-sm border-border/60 hover:border-border transition-colors">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="font-mono text-[10px] text-muted-foreground">#{card.id}</div>
          <Badge variant="outline" className="text-[10px] uppercase">{card.orderType?.replace('_', ' ')}</Badge>
        </div>
        <h4 className="font-semibold text-sm leading-tight mb-3 line-clamp-2">{card.productName}</h4>
        
        <div className="flex justify-between items-end mt-4">
          <div className="text-2xl font-bold text-primary">
            {card.targetQty} <span className="text-xs font-normal text-muted-foreground">units</span>
          </div>
          {card.status === "pending" && <Button size="sm" variant="secondary" className="h-7 text-xs">Start</Button>}
          {card.status === "processing" && <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white">Complete</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
