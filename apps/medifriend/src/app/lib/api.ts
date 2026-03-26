import type {
  AlternativesResponse,
  EntityType,
  IntentResponse,
  SearchResponse,
} from './types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const data = await response.json();
      if (typeof data?.detail === 'string') {
        message = data.detail;
      }
    } catch {
      // Keep the default message when the error response is not JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function postIntent(text: string): Promise<IntentResponse> {
  return request<IntentResponse>('/intent', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function searchMedicines(query: string, kind?: EntityType): Promise<SearchResponse> {
  const params = new URLSearchParams({ query });
  if (kind && kind !== 'unknown') {
    params.set('kind', kind);
  }

  return request<SearchResponse>(`/search?${params.toString()}`);
}

export function getAlternatives(
  saltKey: string,
  excludeName?: string,
): Promise<AlternativesResponse> {
  const params = new URLSearchParams({ salt_key: saltKey });
  if (excludeName) {
    params.set('exclude_name', excludeName);
  }

  return request<AlternativesResponse>(`/alternatives?${params.toString()}`);
}
