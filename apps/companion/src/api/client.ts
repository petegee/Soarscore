import type { ErrorResponse } from "@soarscore/shared";

export class ApiError extends Error {
  constructor(readonly response: ErrorResponse) {
    super(response.message);
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  actorName: string;
  clientId: string;
}

export async function apiRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      "X-Actor-Name": options.actorName,
      "X-Client-Id": options.clientId,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(data as ErrorResponse);
  }

  return data as T;
}
