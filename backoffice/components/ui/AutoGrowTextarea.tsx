'use client';

import {
  ChangeEvent,
  KeyboardEvent,
  TextareaHTMLAttributes,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';

interface AutoGrowTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

/**
 * A single-line-value textarea: it wraps and grows/shrinks with its content so
 * the whole text stays visible while typing, but the VALUE never contains
 * newlines — Enter is ignored and pasted line breaks become spaces (parity with
 * the plain <input> it replaces).
 */
const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, AutoGrowTextareaProps>(
  ({ className = '', error, value, onChange, onKeyDown, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    useLayoutEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = 'auto';
      // scrollHeight excludes borders; add them back so nothing gets clipped.
      el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
    }, [value]);

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
      onKeyDown?.(e);
      if (e.key === 'Enter' && !e.defaultPrevented) e.preventDefault();
    }

    function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
      if (e.target.value.includes('\n')) {
        e.target.value = e.target.value.replace(/\r?\n/g, ' ');
      }
      onChange?.(e);
    }

    return (
      <textarea
        ref={innerRef}
        rows={1}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={`w-full resize-none overflow-hidden px-3 py-2 bg-white border rounded-lg
          text-sm leading-snug text-text-primary placeholder:text-text-muted
          focus:outline-none focus:ring-2 focus:ring-ring-focus focus:border-transparent
          transition-colors duration-200
          ${error ? 'border-danger' : 'border-border hover:border-border-light'}
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-hover
          ${className}`}
        {...props}
      />
    );
  }
);

AutoGrowTextarea.displayName = 'AutoGrowTextarea';

export default AutoGrowTextarea;
