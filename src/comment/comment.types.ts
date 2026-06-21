export interface CommentAuthorDto {
  id: string;
  pseudo: string;
  avatar_url: string | null;
  grade: string;
}

export interface CommentResponseDto {
  id: string;
  wish_id: string;
  content: string;
  is_reported: boolean;
  created_at: Date;
  author: CommentAuthorDto;
}

export interface PaginatedCommentsDto {
  data: CommentResponseDto[];
  total: number;
  page: number;
  limit: number;
}
