export interface StartResponse {
  session_id: string;
  first_question: string;
  question_number: number;
  total_questions: number;
}

export interface FeedbackItem {
  category: string;
  score: number;
  comment: string;
}

export interface AnswerResponse {
  feedback: FeedbackItem[];
  overall_score: number;
  sample_answer: string;
  next_question: string | null;
  is_complete: boolean;
  question_number: number;
  total_questions: number;
}

export interface SummaryResponse {
  session_id: string;
  role: string;
  level: string;
  average_score: number;
  total_questions: number;
  verdict: string;
  top_strengths: string[];
  top_improvements: string[];
}
