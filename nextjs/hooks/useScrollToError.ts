import { useEffect } from 'react';
import { FieldErrors } from 'react-hook-form';

/**
 * Custom hook that automatically scrolls to the first form field with an error
 *
 * @param errors - The errors object from react-hook-form's formState
 * @param options - Configuration options for scroll behavior
 *
 * @example
 * const { formState: { errors } } = useForm();
 * useScrollToError(errors);
 */
export function useScrollToError<T extends Record<string, any>>(
  errors: FieldErrors<T>,
  options: {
    behavior?: ScrollBehavior;
    block?: ScrollLogicalPosition;
    inline?: ScrollLogicalPosition;
    offset?: number;
  } = {}
) {
  const {
    behavior = 'smooth',
    block = 'center',
    inline = 'nearest',
    offset = 0,
  } = options;

  useEffect(() => {
    // Get the first error field name
    const firstErrorKey = Object.keys(errors)[0];

    if (!firstErrorKey) {
      return;
    }

    // Find the input element by name attribute
    const errorElement = document.querySelector<HTMLElement>(
      `[name="${firstErrorKey}"]`
    );

    if (!errorElement) {
      return;
    }

    // Calculate the scroll position with offset
    const scrollToElement = () => {
      const elementRect = errorElement.getBoundingClientRect();
      const absoluteElementTop = elementRect.top + window.pageYOffset;
      const middle = absoluteElementTop - offset;

      // Use native scrollIntoView for better browser support
      if (offset === 0) {
        errorElement.scrollIntoView({
          behavior,
          block,
          inline,
        });
      } else {
        // Manual scroll with offset
        window.scrollTo({
          top: middle,
          behavior,
        });
      }

      // Focus the element after scrolling
      // Use a small delay to ensure scroll completes first
      setTimeout(() => {
        errorElement.focus({ preventScroll: true });
      }, behavior === 'smooth' ? 300 : 0);
    };

    scrollToElement();
  }, [errors, behavior, block, inline, offset]);
}
