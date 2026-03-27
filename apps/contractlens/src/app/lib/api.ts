import type { AnalyzeResponse, ChatResponse } from './types';
const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const P = `${BASE}/api/contractlens`;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${P}${path}`, { headers: { ...(init?.headers ?? {}) }, ...init });
  if (!r.ok) {
    let msg = `Error ${r.status}`;
    try { const d = await r.json(); if (d?.detail) msg = d.detail; } catch {}
    throw new Error(msg);
  }
  return r.json() as Promise<T>;
}

export const analyzeContract = (file: File): Promise<AnalyzeResponse> => {
  const form = new FormData();
  form.append('file', file);
  return req<AnalyzeResponse>('/analyze', { method: 'POST', body: form });
};

export const chatContract = (contract_text: string, question: string): Promise<ChatResponse> =>
  req<ChatResponse>('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contract_text, question }),
  });
