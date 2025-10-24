import { Link, useLocation } from "wouter";
import {
  Smartphone,
  BarChart3,
  QrCode,
  LogOut,
  Pizza,
  Menu,
  X,
  Users,
  Activity,
  Target,
} from "lucide-react";
import { useAuth } from "../hooks/use-auth";
import { authorizer } from "../lib/policy";
import { getTenantContext, getHighestRole } from "../lib/authz";
import { Button } from "../components/ui/button";
import { useState, useEffect, useRef } from "react";

export function Navigation() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const scrollContainerRef = useRef(null as HTMLDivElement | null);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  // Define navigation items and allowed items
  const navItems = [
    {
      path: "/customer",
      label: "App Cliente",
      icon: Smartphone,
      resource: 'nav', action: 'customer',
    },
    {
      path: "/scan-qr",
      label: "Scanner QR",
      icon: QrCode,
      resource: 'nav', action: 'scanQr',
    },
    {
      path: "/dashboard",
      label: "Dashboard Proprietario",
      icon: BarChart3,
      resource: 'nav', action: 'dashboard',
    },
    {
      path: "/crm",
      label: "CRM Clienti",
      icon: Users,
      resource: 'nav', action: 'crm',
    },
    {
      path: "/marketing-automations",
      label: "Marketing",
      icon: Target,
      resource: 'nav', action: 'marketing',
    },
    {
      path: "/kpi",
      label: "KPI Sviluppatore",
      icon: Activity,
      resource: 'nav', action: 'kpi',
    },
  ];

  // Filter navigation items based on tenant-scoped authorization
  const ctx = getTenantContext();
  const allowedNavItems = user ? navItems.filter((item: any) => authorizer.can(user as any, item.resource, item.action, ctx)) : [];

  // Check if scroll indicator should be shown
  useEffect(() => {
    if (!user) return;
    
    const checkScrollable = () => {
      if (scrollContainerRef.current) {
        const { scrollWidth, clientWidth, scrollLeft } = scrollContainerRef.current;
        const hasOverflow = scrollWidth > clientWidth;
        const canScrollRight = scrollLeft < (scrollWidth - clientWidth - 10); // 10px threshold
        setShowScrollIndicator(hasOverflow && canScrollRight);
      }
    };

    checkScrollable();
    
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollable);
      window.addEventListener('resize', checkScrollable);
      
      return () => {
        container.removeEventListener('scroll', checkScrollable);
        window.removeEventListener('resize', checkScrollable);
      };
    }
  }, [user, allowedNavItems]);

  // Don't show navigation if user is not authenticated
  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const NavItem = ({
    item,
    className = "",
  }: {
    item: any;
    className?: string;
  }) => {
    const Icon = item.icon;
    const isActive =
      location === item.path || (location === "/" && item.path === "/customer");

    return (
      <Link key={item.path} href={item.path}>
        <span
          className={`flex items-center space-x-3 transition-colors cursor-pointer ${className} ${
            isActive
              ? "text-brand-blue bg-blue-50"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <Icon className="w-5 h-5" />
          <span className="font-medium">{item.label}</span>
        </span>
      </Link>
    );
  };

  return (
    <>
      {/* Desktop Navigation */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-16">
            {/* Fixed Left: Logo */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              <Pizza className="w-6 h-6 text-brand-blue" />
              <span className="text-lg font-bold text-gray-900 whitespace-nowrap">Che Pizza</span>
            </div>

            {/* Scrollable Middle: Navigation Links (Desktop only) */}
            <div className="flex-1 px-4 min-w-0 hidden md:block relative">
              <div 
                ref={scrollContainerRef}
                className="overflow-x-auto scrollbar-hide"
              >
                <nav className="flex space-x-6 min-w-max">
                  {allowedNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      location === item.path ||
                      (location === "/" && item.path === "/customer");

                    return (
                      <Link key={item.path} href={item.path}>
                        <span
                          className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 transition-colors cursor-pointer ${
                            isActive
                              ? "border-brand-blue text-brand-blue"
                              : "border-transparent text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
              
              {/* Scroll Indicator */}
              {showScrollIndicator && (
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none flex items-center justify-end pr-1">
                  <div className="flex space-x-1">
                    <div className="w-1 h-1 bg-gray-400 rounded-full opacity-60"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full opacity-40"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full opacity-20"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile: Spacer */}
            <div className="flex-1 md:hidden"></div>

            {/* Fixed Right: Desktop User Info & Logout + Mobile Menu Button */}
            <div className="flex items-center space-x-4 flex-shrink-0">
              {/* Desktop User Info & Logout */}
              <div className="hidden md:flex items-center space-x-4">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{user.name}</span>
                  {(() => { const hr = getHighestRole(user as any, ctx); return hr && hr !== 'user'; })() && (
                    <span className="text-xs text-gray-400 ml-2">
                      ({getHighestRole(user as any, ctx)})
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                  className="flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Esci</span>
                </Button>
              </div>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Mobile Sidebar */}
          <div className="absolute top-0 left-0 w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out h-[100dvh] min-h-[100svh]">
            <div className="flex flex-col h-full overflow-hidden pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <Pizza className="w-6 h-6 text-brand-blue" />
                  <span className="text-lg font-bold text-gray-900">
                    Che Pizza da Salva
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* User Info */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-600">
                  <div className="font-medium text-gray-900">{user.name}</div>
                  {(() => { const hr = getHighestRole(user as any, ctx); return hr && hr !== 'user'; })() && (
                    <div className="text-xs text-gray-500 mt-1">
                      Ruolo: {getHighestRole(user as any, ctx)}
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="flex-1 py-4 overflow-y-auto">
                {allowedNavItems.map((item) => (
                  <NavItem
                    item={item}
                    className="px-6 py-3 block rounded-lg mx-4 mb-2"
                  />
                ))}
              </nav>

              {/* Logout Button (respect iOS bottom safe area) */}
              <div className="p-4 border-t border-gray-200" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                  className="w-full flex items-center justify-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Esci</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
