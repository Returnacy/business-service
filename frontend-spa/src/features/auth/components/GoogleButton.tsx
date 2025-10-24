import { Button } from '../../../components/ui/button';
import { Loader2 } from 'lucide-react';
import React from 'react';

interface GoogleButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  retry?: boolean;
  className?: string;
}

export function GoogleButton({ onClick, loading, disabled, label = 'Google', retry, className }: GoogleButtonProps) {
  return (
    <Button
      type="button"
      className={`h-12 bg-amber-500 hover:bg-amber-600 text-white ${className || ''}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />...</> : retry ? 'Riprova' : label}
    </Button>
  );
}

export default GoogleButton;
