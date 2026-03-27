import type { ChatResponse, PlanResponse } from './types';
const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/nutriplan').replace(/\/$/, '');

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init,
  });
  if (!r.ok) {
    let msg = `Error ${r.status}`;
    try { const d = await r.json(); if (d?.detail) msg = d.detail; } catch {}
    throw new Error(msg);
  }
  return r.json() as Promise<T>;
}

export const generatePlan = (
  goal: string, diet_type: string, calories_target: number | null,
  allergies: string[], days: number, meals_per_day: number,
): Promise<PlanResponse> =>
  req<PlanResponse>('/plan', {
    method: 'POST',
    body: JSON.stringify({ goal, diet_type, calories_target, allergies, days, meals_per_day }),
  });

export const chatNutri = (question: string, plan_summary?: string): Promise<ChatResponse> =>
  req<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ question, plan_summary: plan_summary ?? null }),
  });
