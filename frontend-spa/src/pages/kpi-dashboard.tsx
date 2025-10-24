import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Mail, MessageSquare, Users, UserCheck, UserX, Activity, TrendingUp, Calendar, TrendingDown } from "lucide-react";
import { getQueryFn } from "../lib/queryClient";

interface KPIOverview {
  emailsSent30d: number;
  smsSent30d: number;
  emailsSent7d: number;
  smsSent7d: number;
  unverifiedEmailsPercentage: number;
  inactiveUsers30d: number;
}

interface RegistrationData {
  dailyRegistrations: Array<{ date: string; count: number }>;
}



export default function KPIDashboard() {
  const [registrationDays, setRegistrationDays] = useState("30");

  // Fetch KPI overview data
  const { data: kpiOverview, isLoading: kpiLoading } = useQuery<KPIOverview>({
    queryKey: ["/api/kpi/overview"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Fetch registration data
  const { data: registrationData, isLoading: registrationLoading } = useQuery<RegistrationData>({
    queryKey: ["/api/kpi/registrations", registrationDays],
    queryFn: async () => {
      const res = await fetch(`/api/kpi/registrations?days=${registrationDays}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return await res.json();
    },
  });



  // Combine registration data for chart
  const combinedRegistrationData = registrationData ? 
    registrationData.dailyRegistrations.map(item => {
      return {
        date: new Date(item.date).toLocaleDateString('it-IT', { month: 'short', day: 'numeric' }),
        "Registrazioni Normali": item.count,
      };
    }) : [];



  if (kpiLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento KPI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard KPI Sviluppatore</h1>
            <p className="text-gray-600 mt-2">Metriche operative e indicatori di performance</p>
          </div>
          <Badge variant="outline" className="text-purple-600 border-purple-600">
            <Activity className="w-4 h-4 mr-1" />
            ADMIN ONLY
          </Badge>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Email Metrics */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Email Inviate</CardTitle>
              <Mail className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiOverview?.emailsSent30d || 0}</div>
              <p className="text-xs text-muted-foreground">
                Ultimi 30 giorni ({kpiOverview?.emailsSent7d || 0} negli ultimi 7 giorni)
              </p>
            </CardContent>
          </Card>

          {/* SMS Metrics */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SMS Inviati</CardTitle>
              <MessageSquare className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiOverview?.smsSent30d || 0}</div>
              <p className="text-xs text-muted-foreground">
                Ultimi 30 giorni ({kpiOverview?.smsSent7d || 0} negli ultimi 7 giorni)
              </p>
            </CardContent>
          </Card>

          {/* Email Verification */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Email Non Verificate</CardTitle>
              <UserX className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiOverview?.unverifiedEmailsPercentage || 0}%</div>
              <p className="text-xs text-muted-foreground">
                Percentuale utenti con email non verificata
              </p>
            </CardContent>
          </Card>

          {/* Inactive Users */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utenti Inattivi</CardTitle>
              <Users className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiOverview?.inactiveUsers30d || 0}</div>
              <p className="text-xs text-muted-foreground">
                Nessun timbro negli ultimi 30 giorni
              </p>
            </CardContent>
          </Card>

          {/* Communication Trend */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trend Comunicazioni</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {((kpiOverview?.emailsSent7d || 0) + (kpiOverview?.smsSent7d || 0))}
              </div>
              <p className="text-xs text-muted-foreground">
                Totale comunicazioni ultimi 7 giorni
              </p>
            </CardContent>
          </Card>

          {/* System Health */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salute Sistema</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {100 - (kpiOverview?.unverifiedEmailsPercentage || 0)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Utenti con email verificata
              </p>
            </CardContent>
          </Card>
        </div>



        {/* Registration Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Registrazioni Giornaliere
                </CardTitle>
                <CardDescription>
                  Confronto tra registrazioni normali e assistite dallo staff
                </CardDescription>
              </div>
              <Select value={registrationDays} onValueChange={setRegistrationDays}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 giorni</SelectItem>
                  <SelectItem value="14">14 giorni</SelectItem>
                  <SelectItem value="30">30 giorni</SelectItem>
                  <SelectItem value="90">90 giorni</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {registrationLoading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={combinedRegistrationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar 
                    dataKey="Registrazioni Normali" 
                    fill="#3b82f6" 
                    name="Registrazioni Normali"
                  />
                  <Bar 
                    dataKey="Registrazioni Staff" 
                    fill="#10b981" 
                    name="Registrazioni Staff"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Riepilogo Comunicazioni</CardTitle>
              <CardDescription>Panoramica delle comunicazioni inviate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Email di verifica</span>
                <span className="font-semibold">{kpiOverview?.emailsSent30d || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">SMS di verifica</span>
                <span className="font-semibold">{kpiOverview?.smsSent30d || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Totale comunicazioni</span>
                <span className="font-semibold">
                  {(kpiOverview?.emailsSent30d || 0) + (kpiOverview?.smsSent30d || 0)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Riepilogo Utenti</CardTitle>
              <CardDescription>Stato e attività degli utenti</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Utenti inattivi (30gg)</span>
                <span className="font-semibold text-red-600">{kpiOverview?.inactiveUsers30d || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Email non verificate</span>
                <span className="font-semibold text-orange-600">{kpiOverview?.unverifiedEmailsPercentage || 0}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Salute sistema</span>
                <span className="font-semibold text-green-600">
                  {100 - (kpiOverview?.unverifiedEmailsPercentage || 0)}%
                </span>
              </div>
            </CardContent>
          </Card>


        </div>
      </div>
    </div>
  );
}