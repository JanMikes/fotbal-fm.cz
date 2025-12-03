'use client';

import { forwardRef, useRef, useImperativeHandle, useCallback, TextareaHTMLAttributes } from 'react';
import { Bold, Italic, Heading2, Link, List, ListOrdered, LucideIcon } from 'lucide-react';

interface ToolbarButton {
  icon: LucideIcon;
  prefix: string;
  suffix: string;
  placeholder: string;
  title: string;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { icon: Bold, prefix: '**', suffix: '**', placeholder: 'tučný text', title: 'Tučné (Ctrl+B)' },
  { icon: Italic, prefix: '*', suffix: '*', placeholder: 'kurzíva', title: 'Kurzíva (Ctrl+I)' },
  { icon: Heading2, prefix: '## ', suffix: '', placeholder: 'Nadpis', title: 'Nadpis' },
  { icon: Link, prefix: '[', suffix: '](url)', placeholder: 'text odkazu', title: 'Odkaz' },
  { icon: List, prefix: '- ', suffix: '', placeholder: 'položka', title: 'Seznam' },
  { icon: ListOrdered, prefix: '1. ', suffix: '', placeholder: 'položka', title: 'Číslovaný seznam' },
];

interface MarkdownEditorProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  error?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const MarkdownEditor = forwardRef<HTMLTextAreaElement, MarkdownEditorProps>(
  ({ className = '', error, onChange, value, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);

    const insertMarkdown = useCallback((prefix: string, suffix: string, placeholder: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const selectedText = text.substring(start, end) || placeholder;

      const newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);

      // Create a synthetic event for react-hook-form
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(textarea, newText);
        const event = new Event('input', { bubbles: true });
        textarea.dispatchEvent(event);
      }

      // Set cursor position after the inserted text
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }, []);

    const handleToolbarClick = useCallback((button: ToolbarButton) => {
      insertMarkdown(button.prefix, button.suffix, button.placeholder);
    }, [insertMarkdown]);

    return (
      <div className="space-y-2">
        <div className="flex gap-1 p-2 bg-surface-elevated border border-border rounded-t-lg">
          {TOOLBAR_BUTTONS.map((button, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleToolbarClick(button)}
              title={button.title}
              className="p-2 hover:bg-surface rounded transition-colors text-text-secondary hover:text-text-primary"
            >
              <button.icon className="w-4 h-4" />
            </button>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          className={`w-full px-4 py-2.5 bg-white border rounded-b-lg rounded-t-none -mt-2
            text-text-primary placeholder:text-text-muted
            focus:outline-none focus:ring-2 focus:ring-ring-focus focus:border-transparent
            transition-all duration-200 resize-y min-h-[150px]
            ${error ? 'border-danger focus:ring-danger' : 'border-border hover:border-border-light'}
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}`}
          {...props}
        />
      </div>
    );
  }
);

MarkdownEditor.displayName = 'MarkdownEditor';

export default MarkdownEditor;
