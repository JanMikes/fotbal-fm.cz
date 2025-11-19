'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { X } from 'lucide-react';

interface ImageUploadProps {
  onChange: (files: FileList | null) => void;
  error?: string;
}

interface PreviewImage {
  file: File;
  url: string;
}

export default function ImageUpload({ onChange, error }: ImageUploadProps) {
  const [previews, setPreviews] = useState<PreviewImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) {
      onChange(null);
      return;
    }

    // Create preview URLs for all selected files
    const newPreviews: PreviewImage[] = [];
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        newPreviews.push({
          file,
          url: URL.createObjectURL(file),
        });
      }
    });

    setPreviews((prev) => {
      // Clean up old URLs
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return newPreviews;
    });

    onChange(files);
  };

  const removeImage = (index: number) => {
    setPreviews((prev) => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index].url);
      newPreviews.splice(index, 1);

      // Update the file input
      if (fileInputRef.current) {
        const dt = new DataTransfer();
        newPreviews.forEach((p) => dt.items.add(p.file));
        fileInputRef.current.files = dt.files;
        onChange(dt.files);
      }

      return newPreviews;
    });
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
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

      {previews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview.url}
                alt={`Náhled ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border border-border"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                aria-label="Odstranit obrázek"
              >
                <X className="w-4 h-4" />
              </button>
              <p className="text-xs text-text-muted mt-1 truncate">
                {preview.file.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
