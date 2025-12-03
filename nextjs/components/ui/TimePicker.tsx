import { InputHTMLAttributes, forwardRef } from 'react';

interface TimePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: string;
}

const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  ({ className = '', error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="time"
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

TimePicker.displayName = 'TimePicker';

export default TimePicker;
