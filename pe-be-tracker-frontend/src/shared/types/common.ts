// Common entity types
export interface BaseEntity {
  id: number | string;
  created_at?: string;
  updated_at?: string;
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Loading states
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

// Form states
export interface FormState<T> extends LoadingState {
  data: T;
  isDirty: boolean;
  isValid: boolean;
}

// Modal states
export interface ModalState {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
}

// Select option type
export interface SelectOption<T = string | number> {
  label: string;
  value: T;
  disabled?: boolean;
}
