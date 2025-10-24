// Dashboard page refactored to modular feature components
import { useState, useEffect } from 'react';
import { Card, CardTitle, CardHeader, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { MessageCircle, Download } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { OverviewCards } from '../features/analytics/components/OverviewCards';
import { KPICards } from '../features/analytics/components/KPICards';
import { PriceConfig } from '../features/analytics/components/PriceConfig';
import { DailyTransactionsChart } from '../features/analytics/components/DailyTransactionsChart';
import { useOverviewMetrics, useRepeatRateMetrics, useFrequencyMetrics, useEconomicMetrics, useDailyTransactions } from '../features/analytics/hooks';

// Local interfaces kept for internal mapping (data now derived from two backend endpoints)
// (Feedback & traffic placeholders retained until backend integration)

export default function DashboardPage() {
  const [showAllFeedback, setShowAllFeedback] = useState(false);
  const [stampChartDays, setStampChartDays] = useState("30");
  const [pricePerStamp, setPricePerStamp] = useState("2.50");
  const [isMobile, setIsMobile] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [mobileChartDays, setMobileChartDays] = useState("30");

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Set different default for mobile
  useEffect(() => {
    if (isMobile && stampChartDays === "30") {
      setStampChartDays("7");
    }
  }, [isMobile]);

  // Single analytics endpoint (backend: GET /api/analytics)
  const overviewQuery = useOverviewMetrics();
  const repeatRateQuery = useRepeatRateMetrics();
  const frequencyQuery = useFrequencyMetrics();
  const economicQuery = useEconomicMetrics();

  // Helper for consistent 2-decimal formatting
  const format2 = (n: number | string | null | undefined) => {
    const num = typeof n === 'string' ? parseFloat(n) : (n ?? 0);
    const safe = isFinite(Number(num)) ? Number(num) : 0;
    return safe.toFixed(2);
  };

  // Daily stamps & transactions endpoint (backend: GET /api/analytics/daily-transactions?days=N )
  const dailyDesktop = useDailyTransactions(parseInt(stampChartDays, 10) || 30, true);
  const dailyMobile = useDailyTransactions(parseInt(mobileChartDays, 10) || 30, isMobile);

  // Placeholder arrays for unsupported sections (traffic sources, nps distribution, feedback)
  const trafficSources: any[] = [];
  const npsDistribution: any[] = [];
  const feedback: any[] = [];
  const trafficLoading = false;
  const npsLoading = false;
  const feedbackLoading = false;
  const repeatRateLoading = false;
  const frequencyLoading = false;
  const economicLoading = false;

  // Combine stamp data for chart
  const buildDateSeries = (days: number): Date[] => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const dates: Date[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      dates.push(d);
    }
    return dates;
  };

  const dailyData = dailyDesktop.data || { dailyTransactions: [], dailyStamps: [] };
  const mobileDailyData = dailyMobile.data || { dailyTransactions: [], dailyStamps: [] };

  const combinedStampData = (() => {
    const days = parseInt(stampChartDays, 10) || 30;
    const dates = buildDateSeries(days);
    return dates.map((date, idx) => ({
      date: date.toLocaleDateString("it-IT", { month: "short", day: "numeric" }),
    Timbri: dailyData.dailyStamps?.[idx] ?? 0,
    Transazioni: dailyData.dailyTransactions?.[idx] ?? 0,
    }));
  })();

  const combinedMobileChartData = (() => {
    if (!isMobile) return [];
    const days = parseInt(mobileChartDays, 10) || 30;
    const dates = buildDateSeries(days);
    return dates.map((date, idx) => ({
      date: date.toLocaleDateString("it-IT", { month: "short", day: "numeric" }),
    Timbri: mobileDailyData.dailyStamps?.[idx] ?? 0,
    Transazioni: mobileDailyData.dailyTransactions?.[idx] ?? 0,
    }));
  })();

  // Calculate economic metrics
  const pricePerStampFloat = parseFloat(pricePerStamp) || 0;
  const economicData = economicQuery.data || { totalStamps: 0, totalCouponsRedeemed: 0 };
  const totalRevenue = economicData.totalStamps * pricePerStampFloat;
  const couponCost = economicData.totalCouponsRedeemed * 5; // 5€ per coupon
  const netValue = totalRevenue - couponCost;
  const monthlyLicenseCost = 49.9;
  const roi =
    monthlyLicenseCost > 0
      ? (netValue / monthlyLicenseCost).toFixed(2)
      : "0.00";

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const exportFeedbackToCSV = () => {
    if (!feedback || feedback.length === 0) return;

    const headers = [
      "Data",
      "NPS Score",
      "Categoria",
      "Commento",
      "Fonte di traffico",
    ];
    const csvContent = [
      headers.join(","),
      ...feedback.map((item: any) =>
        [
          `"${formatDate(item.createdAt)}"`,
          item.npsScore,
          `"${item.npsScore <= 6 ? "Detrattore" : item.npsScore <= 8 ? "Passivo" : "Promotore"}"`,
          `"${item.comment || "Nessun commento"}"`,
          `"${item.trafficSource}"`,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `feedback-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportTrafficSourcesToCSV = () => {
    if (!trafficSources || trafficSources.length === 0) return;

    const headers = ["Fonte di traffico", "Numero clienti", "Percentuale"];
    const csvContent = [
      headers.join(","),
      ...trafficSources.map((source: any) =>
        [`"${source.source}"`, source.count, `${source.percentage}%`].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `fonti-traffico-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportNPSDistributionToCSV = () => {
    if (!npsDistribution || npsDistribution.length === 0) return;

    const headers = ["Categoria NPS", "Numero clienti", "Percentuale"];
    const csvContent = [
      headers.join(","),
      ...npsDistribution.map((item: any) =>
        [`"${item.category}"`, item.count, `${item.percentage}%`].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `distribuzione-nps-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      instagram: "bg-pink-100 text-pink-700",
      tiktok: "bg-gray-100 text-gray-700",
      google: "bg-red-100 text-red-700",
      friends: "bg-blue-100 text-blue-700",
      walkby: "bg-green-100 text-green-700",
      other: "bg-purple-100 text-purple-700",
    };
    return colors[source] || "bg-gray-100 text-gray-700";
  };

  if (overviewQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-blue"></div>
      </div>
    );
  }
  if (overviewQuery.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center space-y-4 p-6">
        <p className="text-xl font-semibold text-red-600">Errore nel caricamento delle analytics</p>
  <p className="text-sm text-gray-600 break-all">{(overviewQuery.error as any)?.message || 'Unknown error'}</p>
      </div>
    );
  }
  else {
    console.log(overviewQuery);
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Owner Dashboard
        </h1>
        <p className="text-gray-600">Che Pizza Loyalty System Analytics</p>
      </div>

  {overviewQuery.data && <OverviewCards data={overviewQuery.data} />}

      {repeatRateQuery.data && frequencyQuery.data && economicQuery.data && overviewQuery.data && (
        <KPICards
          repeatRate={repeatRateQuery.data}
          frequency={frequencyQuery.data}
          economic={economicQuery.data}
          pricePerStamp={pricePerStamp}
          onPriceChange={setPricePerStamp}
          totalRevenue={totalRevenue}
          couponCost={couponCost}
          netValue={netValue}
          roi={roi as string}
          subscriptionPrice={overviewQuery.data ? (overviewQuery.data as any).subscriptionPrice ?? 49.9 : 49.9}
          format2={format2}
          priceConfigSlot={
            <PriceConfig
              pricePerStamp={pricePerStamp}
              onChange={setPricePerStamp}
              totalRevenue={totalRevenue}
              couponCost={couponCost}
              netValue={netValue}
              economicStamps={economicData.totalStamps}
              economicCoupons={economicData.totalCouponsRedeemed}
              format2={format2}
            />
          }
        />
      )}
      {/* Daily Stamps Chart */}
      <DailyTransactionsChart
        desktopDays={stampChartDays}
        onDesktopDaysChange={setStampChartDays}
        mobileDays={mobileChartDays}
        onMobileDaysChange={setMobileChartDays}
        isMobile={isMobile}
        loading={dailyDesktop.isLoading}
        mobileLoading={dailyMobile.isLoading}
        combinedDesktop={combinedStampData}
        combinedMobile={combinedMobileChartData}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Customer Traffic Sources */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Customer Traffic Sources</CardTitle>
            <Button variant="ghost" size="sm" onClick={exportTrafficSourcesToCSV} disabled={!trafficSources || trafficSources.length === 0}>
              <Download className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {trafficLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
              </div>
            ) : trafficSources.length > 0 ? (
              <div className="space-y-4">
                {trafficSources.map((source: any) => (
                  <div
                    key={source.source}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 bg-brand-blue rounded-full"></div>
                      <span className="text-gray-700 capitalize">
                        {source.source}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-500 text-sm">
                        {source.count}
                      </span>
                      <span className="font-medium text-gray-900">
                        {source.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No traffic data available yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* NPS Distribution */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>NPS Distribution</CardTitle>
            <Button variant="ghost" size="sm" onClick={exportNPSDistributionToCSV} disabled={!npsDistribution || npsDistribution.length === 0}>
              <Download className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {npsLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
              </div>
            ) : npsDistribution.length > 0 ? (
              <div className="space-y-4">
                {["Promotori", "Passivi", "Detrattori"].map((category) => {
                  // Find data by matching the Italian category name with score ranges
                  const categoryWithRange =
                    category === "Promotori"
                      ? "Promotori (9-10)"
                      : category === "Passivi"
                        ? "Passivi (7-8)"
                        : "Detrattori (0-6)";
                  const data = npsDistribution.find(
                    (d: any) => d.category === categoryWithRange,
                  );
                  const percentage = data?.percentage || 0;
                  const count = data?.count || 0;

                  const getColor = (cat: string) => {
                    switch (cat) {
                      case "Promotori":
                        return "bg-green-500";
                      case "Passivi":
                        return "bg-yellow-500";
                      case "Detrattori":
                        return "bg-red-500";
                      default:
                        return "bg-gray-400";
                    }
                  };

                  return (
                    <div key={category} className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2 w-24">
                        <div
                          className={`w-3 h-3 rounded-full ${getColor(category)}`}
                        />
                        <span className="text-sm font-medium">{category}</span>
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-3">
                        <div
                          className={`${getColor(category)} h-3 rounded-full transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-600 w-16 text-right">
                        {count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Nessun dato NPS disponibile
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Feedback */}
      <Card>
        <CardHeader
          className="flex flex-col sm:flex-row          /* colonna su xs, riga da sm in su   */
          items-start sm:items-center        /* allineamenti corretti             */
          justify-between
          gap-3                              /* spazio fra titolo e bottoni       */"
        >
          <CardTitle>Recent Customer Feedback</CardTitle>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportFeedbackToCSV}
              disabled={!feedback || feedback.length === 0}
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-brand-blue hover:bg-brand-dark">
                  View All
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                <DialogHeader>
                  <DialogTitle>All Customer Feedback</DialogTitle>
                </DialogHeader>
                <div className="overflow-y-auto max-h-[60vh]">
                  {feedbackLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
                    </div>
                  ) : feedback.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-white">
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">
                              Data
                            </th>
                            <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">
                              NPS Score
                            </th>
                            <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">
                              Commento
                            </th>
                            <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">
                              Fonte
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {feedback.map((item: any) => (
                            <tr key={item.id}>
                              <td className="py-4 px-4 text-sm text-gray-900">
                                {formatDate(item.createdAt)}
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center space-x-2">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      item.npsScore <= 6
                                        ? "bg-red-100 text-red-800"
                                        : item.npsScore <= 8
                                          ? "bg-yellow-100 text-yellow-800"
                                          : "bg-green-100 text-green-800"
                                    }`}
                                  >
                                    {item.npsScore}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {item.npsScore <= 6
                                      ? "Detrattore"
                                      : item.npsScore <= 8
                                        ? "Passivo"
                                        : "Promotore"}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-sm text-gray-700">
                                {item.comment ? (
                                  <span>{item.comment}</span>
                                ) : (
                                  <span className="text-gray-400 italic">
                                    Nessun commento
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${getSourceColor(item.trafficSource)}`}
                                >
                                  {item.trafficSource}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <MessageCircle className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">
                        Nessun feedback
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Non ci sono ancora feedback dei clienti da visualizzare.
                      </p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {feedbackLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
            </div>
          ) : feedback.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">
                      Data
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">
                      NPS Score
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">
                      Commento
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">
                      Fonte
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {feedback.slice(0, 10).map((item: any) => (
                    <tr key={item.id}>
                      <td className="py-4 px-4 text-sm text-gray-900">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.npsScore <= 6
                                ? "bg-red-100 text-red-800"
                                : item.npsScore <= 8
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-green-100 text-green-800"
                            }`}
                          >
                            {item.npsScore}
                          </span>
                          <span className="text-xs text-gray-500">
                            {item.npsScore <= 6
                              ? "Detrattore"
                              : item.npsScore <= 8
                                ? "Passivo"
                                : "Promotore"}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700 max-w-xs">
                        {item.comment ? (
                          <span className="truncate block">{item.comment}</span>
                        ) : (
                          <span className="text-gray-400 italic">
                            No comment
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSourceColor(item.trafficSource)}`}>
                          {item.trafficSource}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No feedback submitted yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
