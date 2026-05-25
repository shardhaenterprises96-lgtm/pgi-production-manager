import React, { createContext, useContext, useEffect } from "react";
import { useGetMe, AuthSession } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  user: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasRole: (roles: AuthSession["role"][]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, error } = useGetMe({
    query: { retry: false, refetchOnWindowFocus: false }
  });

  const isAuthenticated = !!user;

  const hasRole = (roles: AuthSession["role"][]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, isAuthenticated, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
