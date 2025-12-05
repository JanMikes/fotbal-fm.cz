import { StrapiImage, StrapiFile, UserInfo } from './match-result';

export type EventType = 'nadcházející' | 'proběhlá';

export interface Event {
  id: string;
  name: string;
  eventType: EventType;
  dateFrom: string;
  dateTo?: string;
  publishDate?: string;
  eventTime?: string;
  eventTimeTo?: string;
  description?: string;
  requiresPhotographer: boolean;
  photos: StrapiImage[];
  files: StrapiFile[];
  authorId: number;
  author?: UserInfo;
  modifiedBy?: UserInfo;
  createdAt: string;
  updatedAt: string;
}

export interface EventFormData {
  name: string;
  eventType: EventType;
  dateFrom: string;
  dateTo?: string;
  publishDate?: string;
  eventTime?: string;
  eventTimeTo?: string;
  description?: string;
  requiresPhotographer?: boolean;
  photos?: FileList;
  files?: FileList;
}

export interface CreateEventRequest {
  name: string;
  eventType: EventType;
  dateFrom: string;
  dateTo?: string;
  publishDate?: string;
  eventTime?: string;
  eventTimeTo?: string;
  description?: string;
  requiresPhotographer?: boolean;
}

export interface StrapiEventResponse {
  data: {
    id: number;
    attributes: {
      name: string;
      eventType: EventType;
      dateFrom: string;
      dateTo: string | null;
      publishDate: string | null;
      eventTime: string | null;
      eventTimeTo: string | null;
      description: string | null;
      requiresPhotographer: boolean;
      photos: {
        data: Array<{
          id: number;
          attributes: StrapiImage;
        }>;
      };
      files: {
        data: Array<{
          id: number;
          attributes: StrapiFile;
        }>;
      };
      author: {
        data: {
          id: number;
          firstname?: string;
          lastname?: string;
        };
      };
      modifiedBy?: {
        data: {
          id: number;
          firstname?: string;
          lastname?: string;
        } | null;
      };
      createdAt: string;
      updatedAt: string;
    };
  };
}

export interface StrapiEventsResponse {
  data: Array<{
    id: number;
    attributes: {
      name: string;
      eventType: EventType;
      dateFrom: string;
      dateTo: string | null;
      publishDate: string | null;
      eventTime: string | null;
      eventTimeTo: string | null;
      description: string | null;
      requiresPhotographer: boolean;
      photos: {
        data: Array<{
          id: number;
          attributes: StrapiImage;
        }>;
      };
      files: {
        data: Array<{
          id: number;
          attributes: StrapiFile;
        }>;
      };
      author: {
        data: {
          id: number;
          firstname?: string;
          lastname?: string;
        };
      };
      modifiedBy?: {
        data: {
          id: number;
          firstname?: string;
          lastname?: string;
        } | null;
      };
      createdAt: string;
      updatedAt: string;
    };
  }>;
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}
