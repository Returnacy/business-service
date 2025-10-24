import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Lock, CheckCircle, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { useToast } from "../hooks/use-toast";
import { z } from "zod";
import { http } from "../lib/http";

// Local schema replacing removed shared schema
const confirmPasswordSchema = z.object({
  token: z.string().min(32).max(64),
  password: z.string().min(8).max(20),
  confirmPassword: z.string().min(8).max(20),
}).refine(d => d.password === d.confirmPassword, { message: 'Le password non coincidono', path: ['confirmPassword'] });
type ResetPasswordData = z.infer<typeof confirmPasswordSchema>;

export default function ResetPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const search = useSearch();
  
  // Extract token from URL
  const urlParams = new URLSearchParams(search);
  const token = urlParams.get('token');

  const form = useForm<ResetPasswordData>({
    resolver: zodResolver(confirmPasswordSchema),
    defaultValues: {
      token: token || "",
      password: "",
      confirmPassword: "",
    },
  });

  // Token verification endpoint removed in new version; rely on backend validation at confirm step
  const tokenVerification = { valid: !!token } as const;
  const verifyingToken = false;
  const tokenError = null;

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordData) => {
      const { confirmPassword, ...payload } = data; // backend expects { token, password }
      // Auth backend route: /auth/password-resets/confirm
      return await http.post<{ message: string }>(`/auth/password-resets/confirm`, payload);
    },
    onSuccess: () => {
      setIsSuccess(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il reset della password",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ResetPasswordData) => {
    resetPasswordMutation.mutate(data);
  };

  // Update form token when URL token changes
  useEffect(() => {
    if (token) {
      form.setValue('token', token);
    }
  }, [token, form]);

  // Show error if no token provided
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-xl text-gray-900">Link Non Valido</CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Il link per il reset della password non è valido o mancante.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/auth/forgot-password">
                Richiedi Nuovo Link
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading while verifying token
  if (verifyingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">Verifica del link in corso...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error if token is invalid or expired
  if (tokenError || !tokenVerification?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-xl text-gray-900">Link Scaduto</CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Il link per il reset della password è scaduto o non valido.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800">
                I link per il reset della password scadono dopo 30 minuti per motivi di sicurezza.
              </p>
            </div>
            <Button asChild className="w-full">
              <Link href="/auth/forgot-password">
                Richiedi Nuovo Link
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show success message
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-xl text-gray-900">Password Aggiornata!</CardTitle>
            <CardDescription className="text-sm text-gray-600">
              La tua password è stata aggiornata con successo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-green-800">
                Ora puoi utilizzare la nuova password per accedere al tuo account.
              </p>
            </div>
            <Button asChild className="w-full">
              <Link href="/auth">
                Vai al Login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show password reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-xl text-gray-900">Reimposta Password</CardTitle>
          <CardDescription className="text-sm text-gray-600">
            Inserisci la tua nuova password qui sotto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nuova Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="Inserisci la nuova password"
                          disabled={resetPasswordMutation.isPending}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={resetPasswordMutation.isPending}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conferma Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Conferma la nuova password"
                          disabled={resetPasswordMutation.isPending}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          disabled={resetPasswordMutation.isPending}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-800">
                  La password deve essere di almeno 8 caratteri e massimo 20.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? "Aggiornamento..." : "Aggiorna Password"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <Link href="/auth">
              <Button variant="ghost" className="text-sm">
                Torna al Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}