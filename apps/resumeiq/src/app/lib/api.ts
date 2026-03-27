import type { AnalyzeResponse, ChatResponse } from './types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/resumeiq').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    let msg = `Request failed with status ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.detail === 'string') msg = data.detail;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function analyzeResume(
  file: File,
  jobDescription?: string,
): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append('file', file);
  if (jobDescription) form.append('job_description', jobDescription);
  return request<AnalyzeResponse>('/analyze', { method: 'POST', body: form });
}

export async function chatWithResume(
  resumeText: string,
  question: string,
  jobDescription?: string,
): Promise<ChatResponse> {
  return request<ChatResponse>('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume_text: resumeText, question, job_description: jobDescription }),
  });
}
