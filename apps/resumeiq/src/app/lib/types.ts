export interface ScoreSection {
  label: string;
  score: number;
  feedback: string;
}

export interface AnalyzeResponse {
  overall_score: number;
  summary: string;
  sections: ScoreSection[];
  strengths: string[];
  improvements: string[];
  keywords_found: string[];
  keywords_missing: string[];
}

export interface ChatResponse {
  answer: string;
}
