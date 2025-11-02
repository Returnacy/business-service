import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import { Navigation } from "./components/navigation";
import AuthPage from "./pages/auth-page";
import CustomerPage from "./pages/customer";
import ScanQRPage from "./pages/scan-qr";
import FeedbackPage from "./pages/feedback";
import DashboardPage from "./pages/dashboard";
import ForgotPasswordPage from "./pages/forgot-password";
import ResetPasswordPage from "./pages/reset-password";
import VerifyEmailPage from "./pages/verify-email";
import CRMPage from "./pages/crm";
import MarketingAutomationsPage from "./pages/marketing-automations";
import KPIDashboard from "./pages/kpi-dashboard";
import NotFound from "./pages/not-found";
import TermsConsentDialog from "./components/TermsConsentDialog";
import PrivacyPage from "./pages/privacy";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/auth/forgot-password" component={ForgotPasswordPage} />
      <Route path="/auth/reset-password" component={ResetPasswordPage} />
  <Route path="/privacy" component={PrivacyPage} />
    <Route path="/password-resets" component={ResetPasswordPage} />
  <Route path="/verify-email" component={VerifyEmailPage} />
  {/* Alias for email verification links sent by backend */}
  <Route path="/email-verifications" component={VerifyEmailPage} />
      
      {/* Protected routes for all authenticated users */}
      <ProtectedRoute path="/" component={CustomerPage} />
      <ProtectedRoute path="/customer" component={CustomerPage} />


      {/* <ProtectedRoute path="/register" component={RegisterPage} /> */}

      {/* Routes accessible by FrontDesk and Admin roles */}
      <ProtectedRoute 
        path="/feedback" 
        component={FeedbackPage} 
        allowedRoles={["staff", "manager", "brand_manager", "admin"]} 
      />

      <ProtectedRoute 
        path="/scan-qr" 
        component={ScanQRPage} 
        allowedRoles={["staff", "manager", "brand_manager", "admin"]}
      />

      {/* Admin-only routes */}
      <ProtectedRoute 
        path="/dashboard" 
        component={DashboardPage} 
        allowedRoles={["manager", "brand_manager", "admin"]}
      />
      <ProtectedRoute 
        path="/crm" 
        component={CRMPage} 
        allowedRoles={["manager", "brand_manager", "admin"]}
      />
      <ProtectedRoute 
        path="/marketing-automations" 
        component={MarketingAutomationsPage} 
        allowedRoles={["manager", "brand_manager", "admin"]}
      />
      
      {/* Dev-only routes */}
      <ProtectedRoute 
        path="/kpi" 
        component={KPIDashboard} 
        allowedRoles={["admin"]}
      />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="min-h-screen bg-brand-cream">
            <Navigation />
            <Router />
          </div>
          {/* Show mandatory consent dialog for users who haven't accepted yet */}
          <TermsConsentDialog />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
