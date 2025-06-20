// Generic API response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

// Common error types
export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

// Request/Response helpers
export interface RequestConfig {
  signal?: AbortSignal;
  timeout?: number;
}

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Generic CRUD operations
export interface CreateData<T> {
  data: Omit<T, 'id' | 'created_at' | 'updated_at'>;
}

export interface UpdateData<T> {
  id: string | number;
  data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>;
}

export interface DeleteData {
  id: string | number;
}