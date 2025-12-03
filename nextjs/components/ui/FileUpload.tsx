'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { X, FileText, File, FileImage, FileVideo, FileAudio } from 'lucide-react';

interface FileUploadProps {
  onChange: (files: FileList | null) => void;
  error?: string;
  accept?: string;
  multiple?: boolean;
}

interface PreviewFile {
  file: File;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function FileUpload({ onChange, error, accept, multiple = true }: FileUploadProps) {
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) {
      onChange(null);
      return;
    }

    const newFiles: PreviewFile[] = Array.from(selectedFiles).map((file) => ({
      file,
    }));

    setFiles(newFiles);
    onChange(selectedFiles);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);

      // Update the file input
      if (fileInputRef.current) {
        const dt = new DataTransfer();
        newFiles.forEach((f) => dt.items.add(f.file));
        fileInputRef.current.files = dt.files;
        onChange(dt.files.length > 0 ? dt.files : null);
      }

      return newFiles;
    });
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        className={`w-full px-4 py-2.5 border rounded-lg bg-surface text-text-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white file:cursor-pointer hover:file:bg-primary-hover focus:outline-none focus:ring-2 transition-colors ${
          error
            ? 'border-danger focus:ring-danger'
            : 'border-border hover:border-border-light focus:ring-primary'
        }`}
      />

      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <span className="inline-block w-4 h-4 text-center">⚠</span>
          {error}
        </p>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((item, index) => {
            const IconComponent = getFileIcon(item.file.type);
            return (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-surface-alt border border-border rounded-lg group"
              >
                <IconComponent className="w-8 h-8 text-text-secondary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{item.file.name}</p>
                  <p className="text-xs text-text-muted">
                    {formatFileSize(item.file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  aria-label="Odstranit soubor"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
