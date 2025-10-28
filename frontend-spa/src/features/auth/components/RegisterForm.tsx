import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '../../../components/ui/form';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { RegistrationFormValues } from '../hooks/useAuthForms';


interface Props {
  form: UseFormReturn<any>;
  onSubmit: (v: RegistrationFormValues) => void;
  signupMethod: 'password' | 'google';
  loading: boolean;
  googleError?: Error | null;
}

export function RegisterForm({ form, onSubmit, signupMethod, loading, googleError }: Props) {
  const isPassword = signupMethod === 'password';
  const acceptedTerms = form.watch('acceptedTermsAndConditions');
  const acceptedPrivacy = form.watch('acceptedPrivacyPolicy');
  // Debug: log validation errors when submit fails
  const handleInvalid = (errors: Record<string, any>) => {
    const values = form.getValues();
    const flattened: string[] = [];
    for (const [key, val] of Object.entries(errors)) {
      const msg = (val as any)?.message || (val as any)?._errors?.[0] || JSON.stringify(val);
      flattened.push(`${key}: ${msg}`);
    }
    // eslint-disable-next-line no-console
    console.warn('[RegisterForm] submit prevented due to validation errors ->', flattened);
    // eslint-disable-next-line no-console
    console.log('[RegisterForm] current form values', values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => {
        // eslint-disable-next-line no-console
        console.log('[RegisterForm] onSubmit called with values', v, 'signupMethod=', signupMethod);
        onSubmit(v);
      }, handleInvalid)} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} type="text" placeholder="Mario" className="h-12" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="surname" render={({ field }) => (
            <FormItem><FormLabel>Cognome</FormLabel><FormControl><Input {...field} type="text" placeholder="Rossi" className="h-12" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" placeholder="email@esempio.com" className="h-12" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem><FormLabel>Telefono (opzionale)</FormLabel><FormControl><Input {...field} type="tel" placeholder="+39 1234567890" className="h-12" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        {signupMethod==='password' && (
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem><FormLabel>Password</FormLabel><FormControl><Input {...field} type="password" placeholder="Minimo 8 caratteri" className="h-12" /></FormControl><FormMessage /></FormItem>
          )} />
        )}
        <FormField control={form.control} name="birthdate" render={({ field }) => (
          <FormItem><FormLabel>Data di nascita</FormLabel><FormControl><Input {...field} type="date" className="h-12" /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="space-y-2 text-sm border rounded-md p-3 bg-gray-50">
          <div className="flex items-start gap-2">
            <input type="checkbox" id="acceptedTermsAndConditions" className="mt-1 h-4 w-4" {...form.register('acceptedTermsAndConditions', { required: true })} />
            <label htmlFor="acceptedTermsAndConditions" className="leading-snug">Accetto i <a href="/terms" target="_blank" className="text-brand-blue underline">Termini e Condizioni</a></label>
          </div>
          {!form.watch('acceptedTermsAndConditions') && form.formState.isSubmitted && (<p className="text-red-500 text-xs">Devi accettare i Termini e Condizioni</p>)}
          <div className="flex items-start gap-2">
            <input type="checkbox" id="acceptedPrivacyPolicy" className="mt-1 h-4 w-4" {...form.register('acceptedPrivacyPolicy', { required: true })} />
            <label htmlFor="acceptedPrivacyPolicy" className="leading-snug">Accetto l' <a href="/privacy" target="_blank" className="text-brand-blue underline">Informativa Privacy</a></label>
          </div>
          {!form.watch('acceptedPrivacyPolicy') && form.formState.isSubmitted && (<p className="text-red-500 text-xs">Devi accettare l'Informativa Privacy</p>)}
        </div>
        <div className="flex gap-2 items-start">
          {isPassword ? (
            <Button
              type="submit"
              className="flex-1 h-12 bg-brand-blue hover:bg-brand-dark"
              disabled={loading || !acceptedTerms || !acceptedPrivacy}
            >
              {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Registrazione...</>) : 'Registrati'}
            </Button>
          ) : (
            // In Google mode, rely on the official Google button below
            null
          )}
        </div>
        {signupMethod==='google' && (
          <div className="mt-2 p-2 text-sm text-gray-600">
            {googleError ? <span className="text-red-600">Errore Google: {googleError.message}</span> : 'Continua con Google cliccando il bottone ufficiale'}
          </div>
        )}
        {googleError && signupMethod==='google' && (
          <div className="flex items-start gap-2 text-amber-600 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>Errore Google: {googleError.message}</span>
          </div>
        )}
      </form>
    </Form>
  );
}
