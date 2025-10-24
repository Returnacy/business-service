import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '../../../components/ui/form';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';

interface Props {
  form: UseFormReturn<{ email: string; password: string }>;
  onSubmit: (v: { email: string; password: string }) => void;
  loginMethod: 'password' | 'google';
  toggleMethod: () => void;
  onGoogle: () => void;
  loading: boolean;
  googleLoading: boolean;
  googleError?: Error | null;
  googleEnabled?: boolean;
}

export function LoginForm({ form, onSubmit, loginMethod, toggleMethod, onGoogle, loading, googleLoading, googleError, googleEnabled = true }: Props) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        {loginMethod === 'password' && (
          <>
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input {...field} type="email" placeholder="email@esempio.com" className="h-12" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl><Input {...field} type="password" placeholder="La tua password" className="h-12" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </>
        )}
        {loginMethod === 'google' && (
          <div className="p-3 text-sm text-gray-600">
            {googleError ? <span className="text-red-600">Errore Google: {googleError.message}</span> : 'Continua con Google cliccando il bottone ufficiale'}
          </div>
        )}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1 h-12 bg-brand-blue hover:bg-brand-dark" disabled={loading || loginMethod !== 'password'}>
            {loginMethod==='password' ? (loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Accesso...</> : 'Accedi') : 'Accedi'}
          </Button>
        </div>
        {!googleEnabled && (
          <p className="text-xs text-gray-500"></p>
        )}
        {googleError && loginMethod==='google' && (
          <div className="flex items-start gap-2 text-amber-600 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>Errore Google: {googleError.message}</span>
          </div>
        )}
      </form>
    </Form>
  );
}
