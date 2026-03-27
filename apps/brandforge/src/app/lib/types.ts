export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  rationale: string;
}

export interface NameOption {
  name: string;
  domain_hint: string;
  rationale: string;
}

export interface BrandResponse {
  brand_names: NameOption[];
  taglines: string[];
  brand_voice: string;
  mission_statement: string;
  value_propositions: string[];
  color_palette: ColorPalette;
  font_recommendations: string[];
  social_bio: string;
  elevator_pitch: string;
}

export interface RefineResponse {
  updated_section: string;
  suggestion: string;
}
