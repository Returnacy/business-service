import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { anonymousSignupSchema, type AnonymousSignupInput } from "../schema/anonymous-signup/anonymous-signup.schema";
import { apiRequest } from "../lib/queryClient";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useToast } from "../hooks/use-toast";
import { Pizza } from "lucide-react";

export default function RegisterPage() {
  const { toast } = useToast();
  const [registeredUser, setRegisteredUser] = useState<any>(null);

  const [phonePrefix, setPhonePrefix] = useState("+39");

  const form = useForm<{ name: string; email?: string; phone: string; birthday: string }>({
    // We still capture original fields, then transform to anonymous schema shape on submit
    resolver: zodResolver(
      // Wrap to allow extra optional fields (email) not required by backend
      anonymousSignupSchema.extend({
        // map composite name+birthday; we keep same form keys and transform later
        name: anonymousSignupSchema.shape.name,
        surname: anonymousSignupSchema.shape.surname.optional(), // will be derived
        birthdate: anonymousSignupSchema.shape.birthdate.optional(),
        email: (anonymousSignupSchema.shape as any).name.optional(), // dummy to bypass RHF complaints
        birthday: anonymousSignupSchema.shape.birthdate.optional(),
      }).partial({ surname: true, birthdate: true }) as any
    ),
    defaultValues: { name: "", email: "", phone: "", birthday: "" },
  });

  const createUserMutation = useMutation({
    mutationFn: async (payload: AnonymousSignupInput) => {
      const response = await apiRequest("POST", "/api/anonymous-signup", payload);
      if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text()}`);
      }
      return response.json(); // { message }
    },
    onSuccess: (_data, variables) => {
      setRegisteredUser({
        name: variables.name,
        surname: variables.surname,
        phone: variables.phone,
      });
      toast({
        title: "Registration Successful!",
        description: "Account creato. SMS di verifica inviato.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || 'Errore sconosciuto',
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: { name: string; email?: string; phone: string; birthday: string }) => {
    const fullName = data.name.trim();
    // Derive name / surname from single input without changing UI
    const parts = fullName.split(/\s+/);
    const derivedName = parts[0] || fullName;
    const derivedSurname = parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || '';
    const birthdate = data.birthday || '';
    const phone = data.phone ? `${phonePrefix}${data.phone.replace(/^0+/, "")}` : data.phone;

    const payload: AnonymousSignupInput = {
      authType: 'anonymous',
      name: derivedName,
      surname: derivedSurname || derivedName,
      phone,
      birthdate,
    };

    // Validate against schema before sending (will throw if invalid)
    const parsed = anonymousSignupSchema.parse(payload);
    createUserMutation.mutate(parsed);
  };

  if (registeredUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-brand-blue rounded-full flex items-center justify-center">
              <Pizza className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-brand-blue">Benvenuto da Test Pizza!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Ciao <strong>{registeredUser.name}{registeredUser.surname ? ` ${registeredUser.surname}` : ''}</strong>! Il tuo account fedeltà è stato creato. Controlla l'SMS per verificare il numero.
            </p>
            <Button 
              onClick={() => window.location.href = `/`}
              className="w-full bg-brand-blue hover:bg-brand-dark"
            >
              Torna alla Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-brand-blue rounded-full flex items-center justify-center">
            <Pizza className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-brand-blue">Unisciti al Programma Fedeltà di Tony's Pizza</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Mario Rossi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email retained in form state but not required by anonymous signup; UI unchanged */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Opzionale)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="mario@esempio.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefono (Opzionale)</FormLabel>
                    <FormControl>
                      <div className="flex">
                        <Select value={phonePrefix} onValueChange={setPhonePrefix}>
                          <SelectTrigger className="w-24 rounded-r-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="+39">+39</SelectItem>
                            <SelectItem value="+1">+1</SelectItem>
                            <SelectItem value="+33">+33</SelectItem>
                            <SelectItem value="+49">+49</SelectItem>
                            <SelectItem value="+34">+34</SelectItem>
                            <SelectItem value="+41">+41</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input 
                          type="tel" 
                          placeholder="333 123 4567" 
                          className="rounded-l-none" 
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="birthday"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data di Nascita (Opzionale)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full bg-brand-blue hover:bg-brand-dark"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "Creazione Account..." : "Crea Account Fedeltà"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
