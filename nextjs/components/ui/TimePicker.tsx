'use client';

import { forwardRef, useMemo, InputHTMLAttributes } from 'react';
import ReactDatePicker, { registerLocale } from 'react-datepicker';
import { cs } from 'date-fns/locale/cs';
import { Clock } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('cs', cs);

interface TimePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value?: string;
  onChange?: (event: { target: { value: string; name?: string } }) => void;
  error?: string;
}

const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  ({ value, onChange, error, className = '', disabled, placeholder = 'Vyberte čas', name, onBlur, ...props }, ref) => {
    // Parse HH:mm string to Date object for react-datepicker
    const selectedTime = useMemo(() => {
      if (value && /^\d{2}:\d{2}/.test(value)) {
        const [hours, minutes] = value.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
      }
      return null;
    }, [value]);

    const handleChange = (date: Date | null) => {
      if (onChange) {
        // Format as HH:mm for form submission
        const formattedTime = date
          ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
          : '';
        // Create a synthetic event-like object for react-hook-form compatibility
        onChange({
          target: { value: formattedTime, name },
        });
      }
    };

    return (
      <div className="relative">
        <ReactDatePicker
          selected={selectedTime}
          onChange={handleChange}
          onBlur={onBlur as () => void}
          locale="cs"
          showTimeSelect
          showTimeSelectOnly
          timeIntervals={15}
          timeCaption="Čas"
          dateFormat="HH:mm"
          timeFormat="HH:mm"
          placeholderText={placeholder}
          disabled={disabled}
          className={`w-full px-4 py-2.5 pl-11 bg-white border rounded-lg
            text-text-primary placeholder:text-text-muted
            focus:outline-none focus:ring-2 focus:ring-ring-focus focus:border-transparent
            transition-all duration-200
            ${error ? 'border-danger' : 'border-border hover:border-border-light'}
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-hover
            ${className}`}
          wrapperClassName="w-full"
          popperClassName="timepicker-popper"
          showPopperArrow={false}
        />
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
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

TimePicker.displayName = 'TimePicker';

export default TimePicker;
