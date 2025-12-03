import { UserInfo } from './match-result';

export interface Comment {
  id: number;
  documentId: string;
  content: string;
  author: UserInfo;
  parentCommentId?: string;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface CommentFormData {
  content: string;
}

export interface CreateCommentRequest {
  content: string;
  author?: number;
  parentComment?: string;
  matchResult?: string;
  tournament?: string;
  event?: string;
}

export interface StrapiCommentResponse {
  data: {
    id: number;
    attributes: {
      content: string;
      author: {
        data: {
          id: number;
          firstname?: string;
          lastname?: string;
        };
      };
      parentComment?: {
        data: {
          id: number;
        } | null;
      };
      replies?: {
        data: Array<{
          id: number;
          attributes: {
            content: string;
            author: {
              data: {
                id: number;
                firstname?: string;
                lastname?: string;
              };
            };
            createdAt: string;
            updatedAt: string;
          };
        }>;
      };
      createdAt: string;
      updatedAt: string;
    };
  };
}

export interface StrapiCommentsResponse {
  data: Array<{
    id: number;
    attributes: {
      content: string;
      author: {
        data: {
          id: number;
          firstname?: string;
          lastname?: string;
        };
      };
      parentComment?: {
        data: {
          id: number;
        } | null;
      };
      replies?: {
        data: Array<{
          id: number;
          attributes: {
            content: string;
            author: {
              data: {
                id: number;
                firstname?: string;
                lastname?: string;
              };
            };
            createdAt: string;
            updatedAt: string;
          };
        }>;
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
