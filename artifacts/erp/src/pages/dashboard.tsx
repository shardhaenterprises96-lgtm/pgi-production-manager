import React from "react";
import { useAuth } from "@/contexts/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetDashboardSummary, useGetSalesTrend, useGetLowStockAlerts, useGetRecentInvoices, useGetCapitalSnapshot, getGetCapitalSnapshotQueryKey } from "@workspace/api-client-react";
import { IndianRupee, FileText, AlertTriangle, CreditCard, PackageOpen, Users, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Dashboard() {
  const { user, hasRole } = useAuth();

  const isManagement = hasRole(["admin", "accountant"]);
  const isAdmin = hasRole(["admin"]);

  if (!isManagement) {
    // If not management, they shouldn't really be here, they should be redirected to catalog
    // But just in case, show a welcome message
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name}</h1>
          <p className="text-muted-foreground mt-2">Navigate using the sidebar to access your modules.</p>
        </div>
      </div>
    );
  }

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: salesTrend } = useGetSalesTrend();
  const { data: lowStockAlerts } = useGetLowStockAlerts();
  const { data: recentInvoices } = useGetRecentInvoices();
  const { data: capital, isLoading: isLoadingCapital } = useGetCapitalSnapshot({
    query: { queryKey: getGetCapitalSnapshotQueryKey(), enabled: isAdmin },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Overview of business performance and alerts.</p>
        </div>
      </div>

      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-transparent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capital</CardTitle>
              <Wallet className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              {isLoadingCapital || !capital ? (
                <div className="h-8 w-32 bg-muted rounded animate-pulse" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {capital.capitalK.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    <span className="text-base text-muted-foreground font-normal ml-1">(₹{capital.capital.toLocaleString(undefined, { maximumFractionDigits: 0 })} / 1000)</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Inventory ₹{capital.inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    {" + "}Receivable ₹{capital.receivable.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    {" + "}Cash ₹{capital.cashInAccounts.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    {" - "}Payable ₹{capital.payable.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Growth (vs previous day)</CardTitle>
              {capital?.growthK == null ? (
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              ) : capital.growthK >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-green-600" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              {isLoadingCapital || !capital ? (
                <div className="h-8 w-32 bg-muted rounded animate-pulse" />
              ) : capital.growthK == null ? (
                <>
                  <div className="text-2xl font-bold text-muted-foreground">—</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    First-day snapshot saved. Growth will appear from tomorrow.
                  </p>
                </>
              ) : (
                <>
                  <div className={`text-2xl font-bold ${capital.growthK >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {capital.growthK >= 0 ? "+" : ""}
                    {capital.growthK.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Δ ₹{(capital.growth ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} since {capital.previousDate ?? "—"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {isLoadingSummary ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse bg-muted/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted rounded"></div>
                <div className="h-4 w-4 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-32 bg-muted rounded mb-2"></div>
                <div className="h-3 w-48 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sales This Month</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{summary.totalSalesThisMonth.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {summary.invoicesThisMonth} invoices generated
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
              <TrendingUp className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{summary.totalOutstanding.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Pending collections from customers
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.lowStockCount}</div>
              <p className="text-xs text-muted-foreground">
                Products below minimum threshold
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.pendingPayments}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting admin approval
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Sales Trend</CardTitle>
            <CardDescription>Monthly revenue overview for the current year.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {salesTrend && salesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="month" 
                    tickFormatter={(value) => {
                      const date = new Date();
                      date.setMonth(value - 1);
                      return format(date, "MMM");
                    }}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₹${value / 1000}k`}
                  />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted)/0.5)'}}
                    contentStyle={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px'}}
                  />
                  <Bar dataKey="totalSales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No sales data available.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Low Stock Alerts</CardTitle>
            <CardDescription>Products requiring immediate attention.</CardDescription>
          </CardHeader>
          <CardContent>
            {lowStockAlerts && lowStockAlerts.length > 0 ? (
              <div className="space-y-4">
                {lowStockAlerts.slice(0, 5).map(alert => (
                  <div key={alert.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{alert.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Min: {alert.minStockThreshold} {alert.unit}
                      </p>
                    </div>
                    <Badge variant="destructive">
                      {alert.currentStock} {alert.unit} left
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                <div className="flex flex-col items-center">
                  <PackageOpen className="h-8 w-8 mb-2 opacity-20" />
                  <p>Inventory levels are healthy.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>Latest billing activity across the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentInvoices && recentInvoices.length > 0 ? (
              <div className="space-y-4">
                {recentInvoices.slice(0, 5).map(invoice => (
                  <div key={invoice.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">{invoice.invoiceNo}</p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.customerName || "Cash Sale"} • {format(new Date(invoice.invoiceDate), "MMM dd, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-sm font-bold">₹{invoice.grandTotal.toLocaleString()}</div>
                      <Badge variant={invoice.status === "saved" ? "default" : "secondary"} className="text-[10px] h-4">
                        {invoice.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No recent invoices.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
