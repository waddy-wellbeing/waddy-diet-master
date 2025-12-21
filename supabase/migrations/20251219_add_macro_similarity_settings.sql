-- Add macro similarity settings for Phase 3 & 4 implementation
-- These settings control how recipe and ingredient alternatives are scored

INSERT INTO system_settings (key, value, description) VALUES
  (
    'macro_similarity_weights',
    '{"protein": 0.5, "carbs": 0.3, "fat": 0.2}'::jsonb,
    'Weights for macro similarity scoring: protein 50%, carbs 30%, fat 20%. Higher protein weight prioritizes protein-matched alternatives.'
  ),
  (
    'min_macro_similarity_threshold',
    '5'::jsonb,
    'Minimum difference in macro similarity score to prioritize alternatives (default: 5 points). Only prioritize by macro similarity if the difference between alternatives is greater than this threshold.'
  )
ON CONFLICT (key) DO NOTHING;
