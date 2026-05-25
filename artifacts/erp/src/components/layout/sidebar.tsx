import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/use-auth";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  FileText, 
  Package, 
  Users, 
  CreditCard, 
  Award, 
  Factory, 
  BarChart3, 
  Settings,
  LogOut,
  Wallet,
  HandCoins,
  KeyRound,
  Truck,
  HardHat,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();
  const { user, hasRole } = useAuth();
  const logout = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        // Clear all cached query data so the stale "me" response
        // doesn't survive the navigation back to /login.
        queryClient.clear();
        window.location.href = "/login";
      }
    });
  };

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["admin", "accountant"] },
    { name: "Catalog", href: "/catalog", icon: ShoppingCart, roles: ["admin", "salesman", "store", "manufacturing", "customer"] },
    { name: "Billing", href: "/billing", icon: FileText, roles: ["admin", "salesman"] },
    { name: "Invoices", href: "/invoices", icon: FileText, roles: ["admin", "salesman", "accountant"] },
    { name: "Inventory", href: "/inventory", icon: Package, roles: ["admin", "store"] },
    { name: "Customers", href: "/customers", icon: Users, roles: ["admin", "salesman", "accountant"] },
    { name: "Payments", href: "/payments", icon: CreditCard, roles: ["admin", "salesman", "accountant"] },
    { name: "Cash Book", href: "/cashbook", icon: HandCoins, roles: ["admin", "accountant"] },
    { name: "Accounts", href: "/accounts", icon: Wallet, roles: ["admin", "accountant"] },
    { name: "Rewards", href: "/rewards", icon: Award, roles: ["admin", "customer"] },
    { name: "Manufacturing", href: "/manufacturing", icon: Factory, roles: ["admin", "manufacturing"] },
    { name: "Purchases", href: "/purchases", icon: Truck, roles: ["admin", "accountant", "store"] },
    { name: "Workers", href: "/workers", icon: HardHat, roles: ["admin", "accountant"] },
    { name: "Expenses", href: "/expenses", icon: Receipt, roles: ["admin", "accountant"] },
    { name: "Reports", href: "/reports", icon: BarChart3, roles: ["admin", "accountant"] },
    { name: "User Accounts", href: "/users", icon: KeyRound, roles: ["admin"] },
    { name: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
  ];

  const visibleItems = navItems.filter(item => hasRole(item.roles as any));

  return (
    <div className="flex flex-col w-64 bg-sidebar border-r border-sidebar-border text-sidebar-foreground h-screen sticky top-0 shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
            V
          </div>
          <span className="font-bold text-lg tracking-tight">VIPRO ERP</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {visibleItems.map((item) => (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm font-medium",
                  location === item.href || (location.startsWith(item.href) && item.href !== "/")
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </div>
            </Link>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium">
            {user?.name?.charAt(0) || "U"}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-none">{user?.name}</span>
            <span className="text-xs text-sidebar-foreground/50 capitalize">{user?.role}</span>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );
}
