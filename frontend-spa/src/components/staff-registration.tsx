import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { User, Phone, Calendar, MessageSquare, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { useToast } from "../hooks/use-toast";
import { anonymousSignupSchema } from "../schema/anonymous-signup/anonymous-signup.schema";
import { queryClient } from "../lib/queryClient";
import { http } from "../lib/http";

interface StaffRegistrationProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Use anonymousSignupSchema directly (authType, phone, name, surname, birthdate)
import { z } from "zod";
type StaffRegistrationFormData = z.infer<typeof anonymousSignupSchema>;

export function StaffRegistration({ onSuccess, onCancel }: StaffRegistrationProps) {
  const [step, setStep] = useState<"form" | "verification" | "success">("form");
  const [verificationPhone, setVerificationPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [registrationData, setRegistrationData] = useState<StaffRegistrationFormData | null>(null);
  const [phonePrefix, setPhonePrefix] = useState("+39");
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { toast } = useToast();

  const form = useForm<StaffRegistrationFormData>({
    resolver: zodResolver(anonymousSignupSchema),
    defaultValues: { authType: 'anonymous', name: "", surname: "", phone: "", birthdate: "" },
  });

  const sendVerificationMutation = useMutation({
    mutationFn: async (phone: string) => {
      return await http.post<{ phone: string }>(`/staff/send-verification`, { phone });
    },
    onSuccess: (data) => {
      setVerificationPhone(data.phone);
      setStep("verification");
      toast({ title: "SMS Inviato", description: "Codice di verifica inviato al numero di telefono" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message || "Errore durante l'invio del codice", variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ verificationCode: _vc, ...data }: StaffRegistrationFormData & { verificationCode: string }) => {
      const payload: StaffRegistrationFormData = { ...data, authType: 'anonymous', name: data.name.trim(), surname: data.surname.trim() };
      anonymousSignupSchema.parse(payload);
      return await http.post(`/anonymous-signup`, payload);
    },
    onSuccess: () => {
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["/api/crm/customers"] });
      toast({ title: "Successo", description: "Cliente registrato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message || "Errore durante la registrazione", variant: "destructive" });
    },
  });

  const onSubmitForm = (data: StaffRegistrationFormData) => {
    const formattedPhone = `${phonePrefix}${data.phone.replace(/^0+/, "")}`;
    const formattedData: StaffRegistrationFormData = { ...data, phone: formattedPhone };
    setRegistrationData(formattedData);
    sendVerificationMutation.mutate(formattedPhone);
  };

  const onSubmitVerification = () => {
    if (!registrationData || !verificationCode) return;
    registerMutation.mutate({ ...registrationData, verificationCode });
  };

  const resetForm = () => {
    setStep("form");
    setVerificationPhone("");
    setVerificationCode("");
    setRegistrationData(null);
    form.reset();
  };

  if (step === "success") {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Cliente Registrato!</h3>
              <p className="text-sm text-gray-600 mt-1">Il nuovo cliente è stato registrato con successo nel sistema.</p>
            </div>
            <div className="space-y-2 pt-4">
              <Button onClick={() => { resetForm(); }} className="w-full">Registra Altro Cliente</Button>
              <Button variant="outline" onClick={onSuccess} className="w-full">Torna al CRM</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "verification") {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <MessageSquare className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-xl">Verifica Telefono</CardTitle>
          <CardDescription>Inserisci il codice di verifica inviato a {verificationPhone}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 mb-2">Codice di Verifica</label>
            <Input id="verification-code" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} placeholder="Inserisci il codice ricevuto via SMS" className="text-center text-lg tracking-widest" maxLength={6} disabled={registerMutation.isPending} />
          </div>
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800">Il codice di verifica è stato inviato via SMS. Potrebbe richiedere alcuni minuti per arrivare.</p>
          </div>
          <div className="space-y-2">
            <Button onClick={onSubmitVerification} disabled={!verificationCode || verificationCode.length < 4 || registerMutation.isPending} className="w-full" size="lg">
              {registerMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifica in corso...</>) : ("Verifica e Registra")}
            </Button>
            <Button variant="outline" onClick={() => sendVerificationMutation.mutate(verificationPhone)} disabled={sendVerificationMutation.isPending} className="w-full">{sendVerificationMutation.isPending ? "Invio..." : "Invia di Nuovo"}</Button>
            <Button variant="ghost" onClick={resetForm} className="w-full" disabled={registerMutation.isPending}>Torna Indietro</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4"><User className="w-6 h-6 text-green-600" /></div>
        <CardTitle className="text-xl">Registra Nuovo Cliente</CardTitle>
        <CardDescription>Registrazione manuale assistita dal personale</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitForm)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><User className="w-4 h-4 mr-2" />Nome *</FormLabel>
                  <FormControl><Input {...field} placeholder="Mario" className="text-lg h-12" disabled={sendVerificationMutation.isPending} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="surname" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><User className="w-4 h-4 mr-2" />Cognome *</FormLabel>
                  <FormControl><Input {...field} placeholder="Rossi" className="text-lg h-12" disabled={sendVerificationMutation.isPending} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Phone className="w-4 h-4 mr-2" />Numero di Telefono *</FormLabel>
                <FormControl>
                  <div className="flex">
                    <Select value={phonePrefix} onValueChange={setPhonePrefix}>
                      <SelectTrigger className="w-20 rounded-r-none h-12"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="+39">+39</SelectItem>
                        <SelectItem value="+1">+1</SelectItem>
                        <SelectItem value="+33">+33</SelectItem>
                        <SelectItem value="+49">+49</SelectItem>
                        <SelectItem value="+34">+34</SelectItem>
                        <SelectItem value="+41">+41</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input {...field} placeholder="3123456789" className="text-lg h-12 rounded-l-none" disabled={sendVerificationMutation.isPending} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="birthdate" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Calendar className="w-4 h-4 mr-2" />Data di Nascita *</FormLabel>
                <FormControl><Input {...field} type="date" className="text-lg h-12" disabled={sendVerificationMutation.isPending} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200"><p className="text-xs text-yellow-800">Un SMS di verifica verrà inviato al numero di telefono inserito.</p></div>
            <div className="space-y-4 pt-2">
              <div className="space-y-2 text-sm">
                <label className="flex items-start space-x-2 cursor-pointer select-none">
                  <input type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" checked={acceptedPrivacy} onChange={(e) => setAcceptedPrivacy(e.target.checked)} />
                  <span>Dichiaro di aver letto e compreso l'Informativa Privacy.</span>
                </label>
                <label className="flex items-start space-x-2 cursor-pointer select-none">
                  <input type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
                  <span>Accetto i Termini e Condizioni del servizio.</span>
                </label>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" size="lg" disabled={sendVerificationMutation.isPending || !acceptedPrivacy || !acceptedTerms}>
                {sendVerificationMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Invio SMS...</>) : ("Invia Codice di Verifica")}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel} className="w-full" disabled={sendVerificationMutation.isPending}>Annulla</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// End of StaffRegistration component using anonymousSignupSchema directly.