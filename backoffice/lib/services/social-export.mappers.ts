/**
 * Pure WBoost raw → DTO mappers of the social-export service (split out so
 * vitest can run them against real listing payloads without the service's
 * config / Sentry wiring). No absolute object-store URL that needs the API
 * host reaches the browser: font files and thumbnails go through same-origin
 * proxies.
 */

import type {
  WboostRawTemplate,
  WboostRawVariant,
  WboostRawInput,
  WboostRawImageInput,
  WboostRawGalleryImage,
  WboostRawDocumentExportVersion,
  WboostRawDocumentExportVersionDetail,
  WboostRawExportVersion,
  WboostRawExportVersionDetail,
  WboostRawTemplateDocument,
} from '@/lib/infrastructure/wboost/types';
import type {
  TemplateDTO,
  TemplateVariantDTO,
  TemplateInputDTO,
  ImageInputDTO,
  GalleryImageDTO,
  GroupPlacements,
  DocumentExportVersionDetailDTO,
  DocumentExportVersionFillDTO,
  ExportVersionDTO,
  ExportVersionDetailDTO,
  ExportVersionFillDTO,
  DocumentDTO,
  MovableElementDTO,
  RenderRows,
  RepeatableRowDTO,
} from '@/lib/social-export/api-types';
import { expandRepeatableRows } from '@/lib/social-export/repeatable-rows';

export function mapInput(raw: WboostRawInput): TemplateInputDTO {
  return {
    id: raw.id,
    name: raw.name,
    maxLength: raw.maxLength,
    locked: raw.locked,
    uppercase: raw.uppercase,
    description: raw.description,
    hidable: raw.hidable,
    // Absent on older payloads → null (falls back to the flat form).
    frame: raw.frame ?? null,
    containerId: raw.containerId ?? null,
    textStyle: raw.textStyle ?? null,
    richText: raw.richText ?? false,
    // Font choice: absent on pre-choice payloads → no switch. Font file URLs
    // go through the same-origin proxy (see richTextOptions below).
    fontOptions: raw.fontOptions
      ? raw.fontOptions.map((font) => ({
          family: font.family,
          fontName: font.fontName,
          faceName: font.faceName,
          weight: font.weight,
          style: font.style,
          url: fontProxyPath(font.family),
        }))
      : null,
    // Colour allowlist: absent on older payloads → any colour (as before).
    colorOptions: raw.colorOptions === undefined ? null : raw.colorOptions,
    // Lists + sample: absent on pre-lists payloads → disabled/none.
    lists: raw.lists ?? false,
    listStyle: raw.listStyle
      ? {
          ...raw.listStyle,
          // Absent before checkbox lists shipped → default drawn checkbox.
          checkboxImageUrl: raw.listStyle.checkboxImageUrl ?? null,
          checkboxCheckedImageUrl: raw.listStyle.checkboxCheckedImageUrl ?? null,
        }
      : null,
    listCheckboxes: raw.listCheckboxes ?? false,
    checklist: raw.checklist ?? null,
    sampleValue: raw.sampleValue ?? null,
    // Absent on older payloads → null (the layers panel sinks it to the end).
    layerIndex: raw.layerIndex ?? null,
  };
}

export function mapImageInput(raw: WboostRawImageInput): ImageInputDTO {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    allowMove: raw.allowMove,
    allowResize: raw.allowResize,
    allowRotate: raw.allowRotate,
    hidable: raw.hidable,
    // Fallbacks cover older API payloads without the upload-target fields.
    directories: raw.directories ?? [],
    includesRoot: raw.includesRoot ?? false,
    frame: raw.frame,
    // Presigned store URL, loadable directly by the browser (not behind the
    // OAuth firewall, unlike the variant thumbnail endpoint).
    defaultImageUrl: raw.defaultImageUrl,
    // Absent on older payloads → null (the layers panel sinks it to the end).
    layerIndex: raw.layerIndex ?? null,
    // Absent on older payloads → a regular (contain-fit) slot.
    isBackground: raw.isBackground ?? false,
    // Absent before image slots could flow in containers → free-standing.
    containerId: raw.containerId ?? null,
  };
}

function mapRepeatableRow(raw: NonNullable<WboostRawVariant['repeatableRows']>[number]): RepeatableRowDTO {
  return {
    containerId: raw.containerId,
    parentContainerId: raw.parentContainerId ?? null,
    name: raw.name ?? null,
    repeat: { min: raw.repeat.min, max: raw.repeat.max, default: raw.repeat.default },
    fitsRows: raw.fitsRows ?? null,
    members: raw.members.map((member) => ({ id: member.id, kind: member.kind, name: member.name ?? null })),
    slots: raw.slots.map((slot) => ({ index: slot.index, containerId: slot.containerId, ids: { ...slot.ids } })),
  };
}

function mapMovableElement(raw: NonNullable<WboostRawVariant['movableElements']>[number]): MovableElementDTO {
  return {
    id: raw.id,
    kind: raw.kind,
    name: raw.name ?? null,
    frame: raw.frame ?? null,
    vertical: raw.vertical === true,
    horizontal: raw.horizontal === true,
    limits: {
      up: raw.limits?.up ?? null,
      down: raw.limits?.down ?? null,
      left: raw.limits?.left ?? null,
      right: raw.limits?.right ?? null,
    },
    range: {
      minX: raw.range?.minX ?? 0,
      maxX: raw.range?.maxX ?? 0,
      minY: raw.range?.minY ?? 0,
      maxY: raw.range?.maxY ?? 0,
    },
    memberIds: raw.memberIds ?? [],
  };
}

/** Map a gallery image; the `url` is a presigned store URL passed through as-is. */
export function mapGalleryImage(raw: WboostRawGalleryImage): GalleryImageDTO {
  return {
    id: raw.id,
    url: raw.url,
    // Null = gallery root (the API omits null fields, so it may be absent).
    directoryId: raw.directoryId ?? null,
    directoryName: raw.directoryName ?? null,
    uploadedAt: raw.uploadedAt ?? null,
  };
}

/**
 * Map one listing variant. Its repeatable rows are EXPANDED to every slot
 * (`expandRepeatableRows`) unless `expand: false` (tests of the raw shape).
 */
export function mapRawVariant(
  raw: WboostRawVariant,
  thumbnailsEnabled: boolean,
  { expand = true }: { expand?: boolean } = {}
): TemplateVariantDTO {
  const mapped = mapVariantShape(raw, thumbnailsEnabled);
  return expand ? expandRepeatableRows(mapped) : mapped;
}

function mapVariantShape(raw: WboostRawVariant, thumbnailsEnabled: boolean): TemplateVariantDTO {
  const hasThumbnailSource = raw.previewImageUrl != null || raw.backgroundImageUrl != null;
  const thumbnailUrl =
    thumbnailsEnabled && hasThumbnailSource
      ? `/api/social-export/thumbnail?variantId=${raw.id}`
      : null;

  return {
    id: raw.id,
    dimension: raw.dimension,
    width: raw.width,
    height: raw.height,
    // Absent on older payloads → null (same as print / free-form variants).
    preset: raw.preset ?? null,
    thumbnailUrl,
    hasDefaultPreview: raw.previewImageUrl != null,
    inputs: raw.inputs.map(mapInput),
    imageInputs: (raw.imageInputs ?? []).map(mapImageInput),
    // Absent on older payloads → nothing recolourable.
    shapeInputs: (raw.shapeInputs ?? []).map((shape) => ({
      id: shape.id,
      name: shape.name ?? null,
      target: shape.target,
      defaultColor: shape.defaultColor,
      colorOptions: shape.colorOptions,
      freeColor: shape.freeColor,
      frame: shape.frame ?? null,
      layerIndex: shape.layerIndex ?? null,
    })),
    // Absent on older payloads → no containers.
    containers: (raw.containers ?? []).map((container) => ({
      id: container.id,
      maxHeight: container.maxHeight,
      y: container.y,
      memberInputIds: container.memberInputIds,
      // Absent on pre-nesting API deploys → flat container, designed gaps.
      memberContainerIds: container.memberContainerIds ?? [],
      gap: container.gap ?? null,
      spaceAfter: container.spaceAfter ?? null,
      nested: container.nested ?? false,
      // Whole-container hide (2026-11): without these the toggles never
      // appear. Absent on older deploys → not hidable, unnamed.
      hidable: container.hidable === true,
      name: container.name ?? null,
      memberImageInputIds: container.memberImageInputIds ?? [],
      repeat: container.repeat ?? null,
    })),
    // Absent before 2026-11 → no repeatable rows / nothing movable.
    repeatableRows: (raw.repeatableRows ?? []).map(mapRepeatableRow),
    movableElements: (raw.movableElements ?? []).map(mapMovableElement),
    // Rich-text toolbar data. Font file URLs point at the store host (may be
    // `localhost` in dev) → rewrite to the same-origin font proxy so the
    // browser can @font-face them (fonts hard-require CORS, images don't).
    richTextOptions: raw.richTextOptions
      ? {
          fonts: raw.richTextOptions.fonts.map((font) => ({
            family: font.family,
            fontName: font.fontName,
            faceName: font.faceName,
            weight: font.weight,
            style: font.style,
            url: fontProxyPath(font.family),
          })),
          colors: raw.richTextOptions.colors,
        }
      : null,
    groupMember: raw.groupMember === true,
  };
}

/** Same-origin proxy path for one font face (keyed by the Fabric family string). */
export function fontProxyPath(family: string): string {
  return `/api/social-export/font?family=${encodeURIComponent(family)}`;
}


export function mapTemplate(raw: WboostRawTemplate, thumbnailsEnabled: boolean): TemplateDTO {
  return {
    id: raw.id,
    name: raw.name,
    position: raw.position,
    categoryId: raw.categoryId,
    categoryName: raw.categoryName,
    variants: raw.variants.map((v) => mapRawVariant(v, thumbnailsEnabled)),
    group: raw.group
      ? {
          id: raw.group.id,
          name: raw.group.name,
          repeatableRows: (raw.group.repeatableRows ?? []).map((row) => ({
            containerId: row.containerId,
            repeat: { min: row.repeat.min, max: row.repeat.max, default: row.repeat.default },
            fitsRows: row.fitsRows ?? null,
          })),
        }
      : null,
    // Absent on pre-documents deploys → an ordinary template.
    document: raw.document
      ? {
          id: raw.document.id,
          name: raw.document.name,
          position: raw.document.position,
          pageId: raw.document.pageId,
        }
      : null,
  };
}

export function mapDocument(raw: WboostRawTemplateDocument, thumbnailsEnabled: boolean): DocumentDTO {
  const pages = raw.pages
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((page) => ({
      id: page.id,
      position: page.position,
      templateId: page.templateId,
      templateName: page.templateName,
      variant: mapRawVariant(page.variant, thumbnailsEnabled),
    }));

  return {
    id: raw.id,
    name: raw.name,
    position: raw.position,
    categoryId: raw.categoryId,
    categoryName: raw.categoryName,
    dimension: raw.dimension,
    width: raw.width,
    height: raw.height,
    printFormat: raw.printFormat === true,
    pages,
    fields: (raw.fields ?? []).map((field) => ({
      id: field.id,
      name: field.name,
      kind: field.kind,
      // `valid: false` = the input was deleted from its page: never fill it.
      bindings: field.bindings
        .filter((binding) => binding.valid)
        .map((binding) => ({ pageId: binding.pageId, inputId: binding.inputId })),
      maxLength: field.maxLength ?? null,
      richText: field.richText === true,
      // Older deploys: no textMode — rich when every bound input is.
      textMode: field.textMode ?? (field.richText === true ? 'rich' : 'plain'),
      hidable: field.hidable === true,
      allowedDirectoryIds: Array.isArray(field.allowedDirectoryIds) ? field.allowedDirectoryIds : null,
    })),
  };
}


export function mapExportVersion(raw: WboostRawExportVersion): ExportVersionDTO {
  return {
    id: raw.id,
    subject: raw.subject,
    groupId: raw.groupId,
    variantId: raw.variantId,
    name: raw.name,
    pinned: raw.pinned,
    pinnedAt: raw.pinnedAt,
    createdAt: raw.createdAt,
    lastExportedAt: raw.lastExportedAt,
    exportCount: raw.exportCount,
    channel: raw.channel,
    summary: raw.summary,
  };
}

export function mapDocumentExportVersion(raw: WboostRawDocumentExportVersion): ExportVersionDTO {
  return {
    id: raw.id,
    subject: 'document',
    groupId: null,
    variantId: null,
    documentId: raw.documentId,
    draft: raw.draft === true,
    name: raw.name,
    pinned: raw.pinned,
    pinnedAt: raw.pinnedAt,
    createdAt: raw.createdAt,
    lastExportedAt: raw.lastExportedAt,
    exportCount: raw.exportCount,
    channel: raw.channel,
    summary: raw.summary,
  };
}

export function mapDocumentExportVersionDetail(raw: WboostRawDocumentExportVersionDetail): DocumentExportVersionDetailDTO {
  const pages: DocumentExportVersionFillDTO['pages'] = {};
  for (const [pageId, page] of Object.entries(raw.fill?.pages ?? {})) {
    pages[pageId] = {
      inputs: (page?.inputs ?? {}) as DocumentExportVersionFillDTO['pages'][string]['inputs'],
      images: (page?.images ?? {}) as DocumentExportVersionFillDTO['pages'][string]['images'],
      shapeColors: page?.shapeColors ?? {},
      rows: (page?.rows ?? {}) as RenderRows,
      offsets: page?.offsets ?? {},
    };
  }
  return {
    ...mapDocumentExportVersion(raw),
    fill: { fields: (raw.fill?.fields ?? {}) as DocumentExportVersionFillDTO['fields'], pages },
  };
}

export function mapExportVersionDetail(raw: WboostRawExportVersionDetail): ExportVersionDetailDTO {
  return {
    ...mapExportVersion(raw),
    // The fill is already in the render request shape; its image `url`s are
    // public store URLs the browser loads directly (like gallery images).
    fill: {
      inputs: (raw.fill?.inputs ?? {}) as ExportVersionFillDTO['inputs'],
      images: (raw.fill?.images ?? {}) as ExportVersionFillDTO['images'],
      placements: (raw.fill?.placements ?? {}) as GroupPlacements,
      shapeColors: raw.fill?.shapeColors ?? {},
      rows: (raw.fill?.rows ?? {}) as RenderRows,
      offsets: (raw.fill?.offsets ?? {}) as ExportVersionFillDTO['offsets'],
    },
  };
}

