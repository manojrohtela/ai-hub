export type EntityType = 'medicine' | 'symptom' | 'unknown';

export type RequestedAction =
  | 'search'
  | 'alternatives'
  | 'details'
  | 'uses'
  | 'unsupported_medical_advice';

export interface MedicineRecord {
  name: string;
  composition: string;
  category: string;
  uses: string[];
  salt_key: string;
  manufacturer: string;
  match_reason?: string | null;
  match_tags: string[];
  score?: number | null;
}

export interface IntentResponse {
  original_text: string;
  entity_type: EntityType;
  entity_value?: string | null;
  requested_action: RequestedAction;
  extracted_medicine?: string | null;
  extracted_symptom?: string | null;
  follow_up_questions: string[];
  confidence: number;
  parser: 'groq' | 'heuristic';
}

export interface SearchResponse {
  query: string;
  entity_type: EntityType;
  matched_text?: string | null;
  summary: string;
  categories: string[];
  primary_result?: MedicineRecord | null;
  medicines: MedicineRecord[];
  follow_up_questions: string[];
  warning: string;
}

export interface AlternativesResponse {
  salt_key: string;
  count: number;
  medicines: MedicineRecord[];
}
