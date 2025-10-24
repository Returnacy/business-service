import React, { createContext, ReactNode, useContext } from "react";
import { getHighestRole, getTenantContext } from "../lib/authz";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
// User type still sourced from compatibility barrel for now; can be migrated later
// Use legacy adapter User shape (normalized) to align with API responses
import { User } from "../lib/legacy-api-adapter";
// New discriminated union auth input types
import { type LoginInput } from "../schema/login/login.schema";
import { type SignupInput } from "../schema/signup/signup.schema";
import { queryClient } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { getCurrentUser, login, logout, registerUser } from "../lib/legacy-api-adapter";
import { ClientType } from "../types/client";

// Helper: determine redirect path based on highest tenant-scoped role
function getRoleBasedRedirectFor(user: any): string {
  const hr = getHighestRole(user, getTenantContext()) || 'user';
  if (hr === 'admin' || hr === 'manager') return '/dashboard';
  if (hr === 'staff') return '/scan-qr';
  return '/';
}

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginInput>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, SignupInput>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<ClientType | null, Error>({
    queryKey: ["/me"],
    queryFn: getCurrentUser,
    retry: false,
  });

  const loginMutation = useMutation<ClientType, Error, LoginInput>({
    mutationFn: async (credentials) => {
      // credentials already discriminated: { authType: 'password', ... } | { authType: 'oauth', provider, idToken }
      return await login(credentials as any);
    },
    onSuccess: (user: ClientType) => {
      queryClient.setQueryData(["/me"], user);
      
      // Role-based redirect after successful login
  const redirectPath = getRoleBasedRedirectFor(user);
      setTimeout(() => {
        window.location.href = redirectPath;
      }, 500);
      
      toast({
        title: "Accesso effettuato",
        description: `Benvenuto, ${user.profile?.name}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore di accesso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation<ClientType, Error, SignupInput>({
    mutationFn: async (credentials) => {
      console.log("=== CLIENT REGISTRATION START ===");
      if (!credentials.acceptedTermsAndConditions || !credentials.acceptedPrivacyPolicy) {
        console.warn('Refusing to submit signup: terms/privacy not accepted');
        throw new Error('Devi accettare Termini e Privacy per continuare');
      }
      // Pass through discriminated union unchanged (password vs oauth)
      const redacted = (creds: SignupInput) => creds.authType === 'password' ? { ...creds, password: '[HIDDEN]' } : creds;
      console.log("Sending registration data:", redacted(credentials as any));
      return await registerUser(credentials as any);
    },
    onSuccess: (user: ClientType) => {
      console.log("Registration mutation success, updating cache with user:", user);
      
      // Clear all cached data and force a complete refresh
      queryClient.clear();
      queryClient.setQueryData(["/me"], user);
      
      // Force refresh to ensure backend session is in sync
      queryClient.refetchQueries({ queryKey: ["/me"] });
      
      toast({
        title: "Registrazione completata",
        description: `Benvenuto, ${user.profile?.name}!`,
      });
      // Optional: role-based redirect similar to login for immediate UX consistency
  const redirectPath = getRoleBasedRedirectFor(user);
      setTimeout(() => {
        window.location.href = redirectPath;
      }, 600);
    },
    onError: (error: Error) => {
      console.error("Registration mutation error:", error);
      toast({
        title: "Errore di registrazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await logout();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/me"], null);
      toast({
        title: "Logout effettuato",
        description: "Arrivederci!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore durante il logout",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}