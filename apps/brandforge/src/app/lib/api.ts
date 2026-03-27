import type { BrandResponse, RefineResponse } from './types';
const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/brandforge').replace(/\/$/, '');

async function req<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = `Error ${r.status}`;
    try { const d = await r.json(); if (d?.detail) msg = d.detail; } catch {}
    throw new Error(msg);
  }
  return r.json() as Promise<T>;
}

export const generateBrand = (
  startup_idea: string, industry: string, target_audience: string,
  tone: string, competitors: string[],
): Promise<BrandResponse> =>
  req<BrandResponse>('/generate', { startup_idea, industry, target_audience, tone, competitors });

export const refineBrand = (brand_data: string, feedback: string): Promise<RefineResponse> =>
  req<RefineResponse>('/refine', { brand_data, feedback });
