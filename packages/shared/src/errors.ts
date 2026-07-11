export interface ErrorResponse {
  code: string;
  message: string;
  details?: unknown;
}

export interface CompetitionRef {
  id: string;
  name: string;
}
