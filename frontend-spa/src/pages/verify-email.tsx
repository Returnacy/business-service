import { useEffect, useMemo, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { http } from "../lib/http";
import { z } from "zod";
import { emailVerificationsSchema, type EmailVerificationsInput } from "../schema/email-verifications.schema";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function VerifyEmailPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Extract token from query string
  const token = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("token") || "";
  }, [search]);

  useEffect(() => {
    async function run() {
      // Validate presence of token per schema
      const parse = emailVerificationsSchema.safeParse({ token });
      if (!parse.success) {
        setErrorMsg(parse.error.errors[0]?.message || "Invalid token");
        setStatus("error");
        return;
      }

      setStatus("submitting");
      setErrorMsg(null);
      try {
        const payload: EmailVerificationsInput = { token };
        await http.post<{ message?: string }>("/auth/email-verifications", payload);
        setStatus("success");
      } catch (e: any) {
        const msg = e?.message || "Failed to verify email";
        setErrorMsg(msg);
        setStatus("error");
      }
    }

    run();
  }, [token]);

  // After success, redirect to homepage after 5 seconds
  useEffect(() => {
    if (status !== "success") return;
    const id = window.setTimeout(() => navigate("/"), 5000);
    return () => window.clearTimeout(id);
  }, [status, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "success" ? (
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          ) : status === "error" ? (
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
          ) : (
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          )}
          <CardTitle className="text-xl text-gray-900">
            {status === "success" ? "Email verificata" : status === "error" ? "Verifica fallita" : "Verifica email in corso"}
          </CardTitle>
          <CardDescription className="text-sm text-gray-600">
            {status === "success"
              ? "La tua email è stata verificata con successo. Verrai reindirizzato alla home in pochi secondi."
              : status === "error"
                ? errorMsg || "Si è verificato un errore nella verifica dell'email."
                : "Attendere mentre verifichiamo il tuo indirizzo email..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === "success" && (
            <Button asChild className="w-full">
              <a href="/auth">Vai al Login</a>
            </Button>
          )}
          {status === "error" && (
            <Button asChild variant="outline" className="w-full">
              <a href="/auth">Torna al Login</a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
