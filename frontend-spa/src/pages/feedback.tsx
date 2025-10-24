import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

// Temporary placeholder Feedback page (original file missing). Replace with real implementation when backend endpoints ready.
export default function FeedbackPage() {
  return (
    <div className="min-h-screen p-6 flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">La pagina feedback non è ancora stata implementata in questa build. Torna più tardi.</p>
        </CardContent>
      </Card>
    </div>
  );
}
