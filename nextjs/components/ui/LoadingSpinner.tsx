interface LoadingSpinnerProps {
  /** Size variant for the spinner */
  size?: 'sm' | 'md' | 'lg';
  /** Loading message to display */
  message?: string;
  /** Whether to display fullscreen centered */
  fullscreen?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6 border-2',
  md: 'h-12 w-12 border-4',
  lg: 'h-16 w-16 border-4',
};

/**
 * Reusable loading spinner component
 * Displays an animated spinner with optional message
 */
export default function LoadingSpinner({
  size = 'md',
  message = 'Načítání...',
  fullscreen = true,
  className = '',
}: LoadingSpinnerProps) {
  const spinnerContent = (
    <div className={`text-center ${className}`}>
      <div
        className={`inline-block animate-spin rounded-full border-border border-t-primary mb-4 ${sizeClasses[size]}`}
        role="status"
        aria-label="Načítání"
      />
      {message && <p className="text-text-secondary">{message}</p>}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="flex items-center justify-center bg-background pt-32">
        {spinnerContent}
      </div>
    );
  }

  return spinnerContent;
}
