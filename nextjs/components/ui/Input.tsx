import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full px-4 py-2.5 bg-surface border rounded-lg
          text-text-primary placeholder:text-text-muted
          focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
          transition-all duration-200
          ${error ? 'border-danger focus:ring-danger' : 'border-border hover:border-border-light'}
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export default Input;
