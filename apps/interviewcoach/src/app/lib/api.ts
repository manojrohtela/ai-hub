import type { AnswerResponse, StartResponse, SummaryResponse } from './types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const P = `${API_BASE}/api/interviewcoach`;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${P}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!r.ok) {
    let msg = `Error ${r.status}`;
    try { const d = await r.json(); if (d?.detail) msg = d.detail; } catch {}
    throw new Error(msg);
  }
  return r.json() as Promise<T>;
}

export const startInterview = (role: string, level: string, focus?: string) =>
  req<StartResponse>('/start', {
    method: 'POST',
    body: JSON.stringify({ role, level, focus: focus || null }),
  });

export const submitAnswer = (session_id: string, answer: string) =>
  req<AnswerResponse>('/answer', {
    method: 'POST',
    body: JSON.stringify({ session_id, answer }),
  });

export const getSummary = (session_id: string) =>
  req<SummaryResponse>(`/summary/${session_id}`);
