import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Catalog from "@/pages/catalog";
import Billing from "@/pages/billing";
import Invoices from "@/pages/invoices";
import InvoiceDetail from "@/pages/invoice-detail";
import Inventory from "@/pages/inventory";
import Customers from "@/pages/customers";
import CustomerProfile from "@/pages/customer-profile";
import Payments from "@/pages/payments";
import Rewards from "@/pages/rewards";
import Manufacturing from "@/pages/manufacturing";
import Purchases from "@/pages/purchases";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import Users from "@/pages/users";
import Accounts from "@/pages/accounts";
import CashBook from "@/pages/cashbook";
import ShopPos from "@/pages/shop-pos";
import ShopInventory from "@/pages/shop-inventory";
import ShopTransfers from "@/pages/shop-transfers";
import ShopCatalog from "@/pages/shop-catalog";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/catalog" component={Catalog} />
        <Route path="/billing" component={Billing} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/invoices/:id" component={InvoiceDetail} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/customers" component={Customers} />
        <Route path="/customers/:id" component={CustomerProfile} />
        <Route path="/payments" component={Payments} />
        <Route path="/rewards" component={Rewards} />
        <Route path="/manufacturing" component={Manufacturing} />
        <Route path="/purchases" component={Purchases} />
        <Route path="/reports" component={Reports} />
        <Route path="/accounts" component={Accounts} />
        <Route path="/cashbook" component={CashBook} />
        <Route path="/settings" component={Settings} />
        <Route path="/users" component={Users} />
        <Route path="/shop/pos" component={ShopPos} />
        <Route path="/shop/inventory" component={ShopInventory} />
        <Route path="/shop/transfers" component={ShopTransfers} />
        <Route path="/shop/catalog" component={ShopCatalog} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/*" component={ProtectedRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
