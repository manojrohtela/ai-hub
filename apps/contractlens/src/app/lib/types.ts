export interface RiskItem {
  clause: string;
  severity: 'high' | 'medium' | 'low';
  explanation: string;
  suggestion: string;
}

export interface AnalyzeResponse {
  contract_type: string;
  party_summary: string;
  key_dates: string[];
  key_obligations: string[];
  risks: RiskItem[];
  risk_score: number;
  plain_summary: string;
  missing_clauses: string[];
}

export interface ChatResponse {
  answer: string;
}
