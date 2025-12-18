export interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface StrapiRawCategory {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
