'use client';

import { forwardRef, useMemo, InputHTMLAttributes } from 'react';
import ReactDatePicker, { registerLocale } from 'react-datepicker';
import { cs } from 'date-fns/locale/cs';
import { Calendar } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('cs', cs);

interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value?: string;
  onChange?: (event: { target: { value: string; name?: string } }) => void;
  error?: string;
}

const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ value, onChange, error, className = '', disabled, placeholder = 'Vyberte datum', name, onBlur, ...props }, ref) => {
    // Derive selected date from value prop
    const selectedDate = useMemo(() => {
      if (value) {
        return new Date(value);
      }
      return null;
    }, [value]);

    const handleChange = (date: Date | null) => {
      if (onChange) {
        // Format as YYYY-MM-DD for form submission
        const formattedDate = date ? date.toISOString().split('T')[0] : '';
        // Create a synthetic event-like object for react-hook-form compatibility
        onChange({
          target: { value: formattedDate, name },
        });
      }
    };

    return (
      <div className="relative">
        <ReactDatePicker
          selected={selectedDate}
          onChange={handleChange}
          onBlur={onBlur as () => void}
          locale="cs"
          dateFormat="d. M. yyyy"
          placeholderText={placeholder}
          disabled={disabled}
          showMonthDropdown
          showYearDropdown
          dropdownMode="select"
          className={`w-full px-4 py-2.5 pl-11 bg-white border rounded-lg
            text-text-primary placeholder:text-text-muted
            focus:outline-none focus:ring-2 focus:ring-ring-focus focus:border-transparent
            transition-all duration-200
            ${error ? 'border-danger' : 'border-border hover:border-border-light'}
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-hover
            ${className}`}
          wrapperClassName="w-full"
          calendarClassName="datepicker-calendar"
          popperClassName="datepicker-popper"
          showPopperArrow={false}
        />
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
        {/* Hidden input for react-hook-form ref compatibility */}
        <input
          ref={ref}
          type="hidden"
          name={name}
          value={value || ''}
          readOnly
          {...props}
        />
      </div>
    );
  }
);

DatePicker.displayName = 'DatePicker';

export default DatePicker;
