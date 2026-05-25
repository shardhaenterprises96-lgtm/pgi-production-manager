import React from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/use-auth";
import { useLogin } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Factory } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const { isAuthenticated, user, isLoading } = useAuth();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  React.useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "admin" || user.role === "accountant") {
        setLocation("/");
      } else {
        setLocation("/catalog");
      }
    }
  }, [isAuthenticated, user, setLocation]);

  if (isLoading || isAuthenticated) {
    return null;
  }

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          if (data.role === "admin" || data.role === "accountant") {
            window.location.href = "/";
          } else {
            window.location.href = "/catalog";
          }
        },
        onError: () => {
          toast({
            title: "Login failed",
            description: "Invalid username or password.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center text-primary-foreground mb-6 shadow-lg shadow-primary/20">
            <Factory className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar-foreground">Shradha Enterprises</h1>
          <p className="text-sidebar-foreground/60 mt-2">Vipro ERP System</p>
        </div>

        <Card className="border-sidebar-border bg-card shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Sign In</CardTitle>
            <CardDescription>Enter your credentials to access the system</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter your password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full font-bold" 
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        <div className="text-center text-sm text-sidebar-foreground/40">
          &copy; {new Date().getFullYear()} Shradha Enterprises. All rights reserved.
        </div>
      </div>
    </div>
  );
}
