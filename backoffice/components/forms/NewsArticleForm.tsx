'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { newsArticleSchema, NewsArticleFormData } from '@/lib/validation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import ImageUpload from '@/components/ui/ImageUpload';
import DatePicker from '@/components/ui/DatePicker';
import TimePicker from '@/components/ui/TimePicker';
import MarkdownEditor from '@/components/ui/MarkdownEditor';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import CategorySelect from '@/components/ui/CategorySelect';
import { useScrollToError } from '@/hooks/useScrollToError';
import { useCreateNewsArticle } from '@/hooks/api';
import { NewsArticle } from '@/types/news-article';
import { StrapiImage } from '@/types/match';

interface NewsArticleFormProps {
  /** Prefilled article title composed from the source entity */
  initialTitle: string;
  /** Prefilled markdown body composed from the source entity */
  initialDescription: string;
  /** Prefilled category documentIds from the source entity */
  initialCategoryIds: string[];
  /** Photos already uploaded to Strapi on the source entity */
  sourceImages: StrapiImage[];
  /** Document attachments already uploaded to Strapi on the source entity */
  sourceFileIds?: number[];
  /** Checkbox label, e.g. 'Převzít fotografie ze zápasu' */
  sourceMediaLabel: string;
  /** Where the back buttons lead, e.g. /vysledek/{id} */
  backHref: string;
  backLabel: string;
}

function currentLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function currentLocalTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function NewsArticleForm({
  initialTitle,
  initialDescription,
  initialCategoryIds,
  sourceImages,
  sourceFileIds,
  sourceMediaLabel,
  backHref,
  backLabel,
}: NewsArticleFormProps) {
  const [gallery, setGallery] = useState<FileList | null>(null);
  const [useSourceMedia, setUseSourceMedia] = useState(sourceImages.length > 0);
  const [createdArticle, setCreatedArticle] = useState<NewsArticle | null>(null);
  const [successWarnings, setSuccessWarnings] = useState<string[]>([]);

  const mutation = useCreateNewsArticle({
    onSuccess: (data, warnings) => {
      setCreatedArticle(data.article);
      setSuccessWarnings(warnings ?? []);
    },
  });
  const { isLoading, error } = mutation;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    control,
  } = useForm<NewsArticleFormData>({
    resolver: zodResolver(newsArticleSchema),
    mode: 'onSubmit',
    defaultValues: {
      title: initialTitle,
      description: initialDescription,
      date: currentLocalDate(),
      time: currentLocalTime(),
      video: '',
      categoryIds: initialCategoryIds,
    },
  });

  const description = watch('description');

  useScrollToError(errors, { offset: 100 });

  const onSubmit = async (data: NewsArticleFormData) => {
    const publishedAt = new Date(`${data.date}T${data.time || '12:00'}`).toISOString();

    await mutation.mutate({
      title: data.title,
      description: data.description,
      date: publishedAt,
      video: data.video || undefined,
      categoryIds: data.categoryIds,
      mainPhotoId: useSourceMedia ? sourceImages[0]?.id : undefined,
      galleryIds: useSourceMedia ? sourceImages.map((img) => img.id) : undefined,
      fileIds: useSourceMedia ? sourceFileIds : undefined,
      gallery,
    });
  };

  if (createdArticle) {
    return (
      <div className="text-center py-8 space-y-4">
        <CheckCircle2 className="w-14 h-14 text-success mx-auto" aria-hidden="true" />
        <h2 className="text-2xl font-bold text-text-primary">
          Aktualita byla vytvořena
        </h2>
        <p className="text-text-secondary">
          „{createdArticle.title}&ldquo; je publikována na webu
          {createdArticle.slug && (
            <> pod adresou <code className="text-sm bg-surface-elevated px-2 py-0.5 rounded">novinky/clanek/{createdArticle.slug}</code></>
          )}
          .
        </p>
        <p className="text-sm text-text-muted">
          Finální úpravy (typ aktuality, související články, další média) můžete provést ve Strapi administraci.
        </p>
        {successWarnings.length > 0 && (
          <Alert variant="warning">
            {successWarnings.map((warning, index) => (
              <div key={index}>{warning}</div>
            ))}
          </Alert>
        )}
        <div className="pt-2">
          <Link href={backHref}>
            <Button variant="primary">{backLabel}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <LoadingSpinner
            fullscreen={false}
            message="Vytváření aktuality..."
            size="lg"
          />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert variant="error">{error}</Alert>
        )}

        <FormField
          label="Titulek"
          error={errors.title?.message}
          required
          hint="Předvyplněný titulek můžete upravit do novinového stylu"
        >
          <Input
            {...register('title')}
            placeholder="Titulek aktuality"
            error={errors.title?.message}
          />
        </FormField>

        <FormField
          label="Kategorie"
          error={errors.categoryIds?.message}
          required
        >
          <Controller
            name="categoryIds"
            control={control}
            render={({ field }) => (
              <CategorySelect
                value={field.value || []}
                onChange={field.onChange}
                error={errors.categoryIds?.message}
                required
              />
            )}
          />
        </FormField>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Datum publikace"
            error={errors.date?.message}
            required
          >
            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  name={field.name}
                  error={errors.date?.message}
                />
              )}
            />
          </FormField>

          <FormField
            label="Čas publikace"
            error={errors.time?.message}
          >
            <Controller
              name="time"
              control={control}
              render={({ field }) => (
                <TimePicker
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  name={field.name}
                  error={errors.time?.message}
                />
              )}
            />
          </FormField>
        </div>

        <FormField
          label="Obsah aktuality"
          error={errors.description?.message}
          required
          hint="Text je předvyplněný z dostupných dat. Upravte jej podle potřeby — podporuje formátování (Markdown)."
        >
          <MarkdownEditor
            value={description || ''}
            onChange={(e) => setValue('description', e.target.value)}
            rows={18}
            placeholder="Obsah aktuality..."
            error={errors.description?.message}
          />
        </FormField>

        {sourceImages.length > 0 && (
          <FormField
            label="Fotografie"
            hint="První převzatá fotografie bude použita jako hlavní fotografie aktuality"
          >
            <label className="flex items-start gap-3 p-4 bg-surface-elevated rounded-lg border border-border cursor-pointer">
              <input
                type="checkbox"
                checked={useSourceMedia}
                onChange={(e) => setUseSourceMedia(e.target.checked)}
                className="mt-1 w-4 h-4 accent-accent"
              />
              <span className="flex-1">
                <span className="block font-medium text-text-primary">
                  {sourceMediaLabel} ({sourceImages.length})
                </span>
                <span className="mt-3 flex flex-wrap gap-2">
                  {sourceImages.slice(0, 8).map((img) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={img.id}
                      src={img.formats?.thumbnail?.url || img.url}
                      alt={img.alternativeText || img.name}
                      className="w-16 h-16 object-cover rounded border border-border"
                    />
                  ))}
                  {sourceImages.length > 8 && (
                    <span className="w-16 h-16 flex items-center justify-center rounded border border-border text-sm text-text-muted">
                      +{sourceImages.length - 8}
                    </span>
                  )}
                </span>
              </span>
            </label>
          </FormField>
        )}

        <FormField
          label="Další fotografie"
          hint="Volitelné - fotografie navíc, které se nahrají do galerie aktuality"
        >
          <ImageUpload onChange={setGallery} />
        </FormField>

        <FormField
          label="Video"
          error={errors.video?.message}
          hint="Volitelné - odkaz na YouTube video"
        >
          <Input
            {...register('video')}
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            error={errors.video?.message}
          />
        </FormField>

        <div className="space-y-4">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Vytváření...' : 'Publikovat aktualitu'}
          </Button>

          <Link
            href={backHref}
            className="block w-full text-center text-sm text-muted underline hover:text-foreground"
          >
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
