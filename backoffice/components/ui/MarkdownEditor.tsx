'use client';

import { forwardRef, useRef, useImperativeHandle, useCallback, useState, TextareaHTMLAttributes } from 'react';
import { Bold, Italic, Heading2, Link, List, ListOrdered, LucideIcon, Eye, Pencil } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ToolbarButton {
  icon: LucideIcon;
  prefix: string;
  suffix: string;
  placeholder: string;
  title: string;
  isList?: boolean;
  isOrdered?: boolean;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { icon: Bold, prefix: '**', suffix: '**', placeholder: 'tučný text', title: 'Tučné (Ctrl+B)' },
  { icon: Italic, prefix: '*', suffix: '*', placeholder: 'kurzíva', title: 'Kurzíva (Ctrl+I)' },
  { icon: Heading2, prefix: '## ', suffix: '', placeholder: 'Nadpis', title: 'Nadpis' },
  { icon: Link, prefix: '[', suffix: '](url)', placeholder: 'text odkazu', title: 'Odkaz' },
  { icon: List, prefix: '- ', suffix: '', placeholder: 'položka', title: 'Seznam', isList: true, isOrdered: false },
  { icon: ListOrdered, prefix: '1. ', suffix: '', placeholder: 'položka', title: 'Číslovaný seznam', isList: true, isOrdered: true },
];

interface MarkdownEditorProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  error?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const MarkdownEditor = forwardRef<HTMLTextAreaElement, MarkdownEditorProps>(
  ({ className = '', error, onChange, value, rows = 8, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isPreview, setIsPreview] = useState(false);

    useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);

    const updateTextareaValue = useCallback((newText: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(textarea, newText);
        const event = new Event('input', { bubbles: true });
        textarea.dispatchEvent(event);
      }
    }, []);

    const insertMarkdown = useCallback((prefix: string, suffix: string, placeholder: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const selectedText = text.substring(start, end) || placeholder;

      const newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);
      updateTextareaValue(newText);

      // Set cursor position after the inserted text
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }, [updateTextareaValue]);

    const insertListMarkdown = useCallback((isOrdered: boolean, placeholder: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const selectedText = text.substring(start, end);

      // If no selection or single line, use simple prefix
      if (!selectedText || !selectedText.includes('\n')) {
        const prefix = isOrdered ? '1. ' : '- ';
        const textToWrap = selectedText || placeholder;
        const newText = text.substring(0, start) + prefix + textToWrap + text.substring(end);
        updateTextareaValue(newText);

        setTimeout(() => {
          textarea.focus();
          const newCursorPos = start + prefix.length + textToWrap.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
        return;
      }

      // Multi-line selection: add prefix to each line
      const lines = selectedText.split('\n');
      const formattedLines = lines.map((line, i) => {
        const prefix = isOrdered ? `${i + 1}. ` : '- ';
        return prefix + line;
      });
      const formattedText = formattedLines.join('\n');
      const newText = text.substring(0, start) + formattedText + text.substring(end);
      updateTextareaValue(newText);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + formattedText.length);
      }, 0);
    }, [updateTextareaValue]);

    const handleToolbarClick = useCallback((button: ToolbarButton) => {
      if (button.isList) {
        insertListMarkdown(button.isOrdered || false, button.placeholder);
      } else {
        insertMarkdown(button.prefix, button.suffix, button.placeholder);
      }
    }, [insertMarkdown, insertListMarkdown]);

    return (
      <div className="space-y-2">
        <div className="flex gap-1 p-2 bg-surface-elevated border border-border rounded-t-lg">
          {TOOLBAR_BUTTONS.map((button, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                if (isPreview) setIsPreview(false);
                handleToolbarClick(button);
              }}
              title={button.title}
              disabled={isPreview}
              className={`p-2 hover:bg-surface rounded transition-colors text-text-secondary hover:text-text-primary
                ${isPreview ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <button.icon className="w-4 h-4" />
            </button>
          ))}
          <div className="flex-1" />
          <div className="flex gap-1 border-l border-border pl-2">
            <button
              type="button"
              onClick={() => setIsPreview(false)}
              title="Editovat"
              className={`p-2 rounded transition-colors ${
                !isPreview
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsPreview(true)}
              title="Náhled"
              className={`p-2 rounded transition-colors ${
                isPreview
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>
        {isPreview ? (
          <div
            className={`w-full px-4 py-2.5 bg-white border rounded-b-lg rounded-t-none -mt-2
              text-text-primary min-h-[150px] max-w-none
              [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-2
              [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-2
              [&_li]:my-1
              [&_p]:my-2
              [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:my-3
              [&_h2]:text-xl [&_h2]:font-bold [&_h2]:my-2
              [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:my-2
              [&_a]:text-primary [&_a]:underline
              [&_strong]:font-bold
              [&_em]:italic
              ${error ? 'border-danger' : 'border-border'}
              ${className}`}
            style={{ minHeight: `${(rows as number) * 1.5}rem` }}
          >
            {value ? (
              <ReactMarkdown>{value as string}</ReactMarkdown>
            ) : (
              <span className="text-text-muted">{props.placeholder || 'Žádný obsah'}</span>
            )}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            rows={rows}
            className={`w-full px-4 py-2.5 bg-white border rounded-b-lg rounded-t-none -mt-2
              text-text-primary placeholder:text-text-muted
              focus:outline-none focus:ring-2 focus:ring-ring-focus focus:border-transparent
              transition-all duration-200 resize-y min-h-[150px]
              ${error ? 'border-danger focus:ring-danger' : 'border-border hover:border-border-light'}
              disabled:opacity-50 disabled:cursor-not-allowed
              ${className}`}
            {...props}
          />
        )}
      </div>
    );
  }
);

MarkdownEditor.displayName = 'MarkdownEditor';

export default MarkdownEditor;
