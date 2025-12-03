import { SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', error, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={`w-full px-4 py-2.5 bg-white border rounded-lg
            text-text-primary
            focus:outline-none focus:ring-2 focus:ring-ring-focus focus:border-transparent
            transition-all duration-200
            appearance-none cursor-pointer
            ${error ? 'border-danger' : 'border-border hover:border-border-light'}
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-hover
            ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
