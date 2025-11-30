-- =============================================================================
-- Update Supplements with missing food_group
-- =============================================================================
-- These are all supplements/medications that should be in the "Supplements" food group

UPDATE ingredients
SET 
  food_group = 'Supplements',
  subgroup = CASE 
    WHEN name IN ('Vitamin D', 'Vi-Drop') THEN 'Vitamins'
    WHEN name IN ('Multi-Vitamins', 'Centrum', 'Perfectil') THEN 'Multivitamins'
    WHEN name IN ('Omega-3') THEN 'Fatty Acids'
    WHEN name IN ('Zinc', 'Magnesium', 'Osteocare 400 Mg') THEN 'Minerals'
    WHEN name IN ('Creatine', 'Glutamine') THEN 'Amino Acids'
    WHEN name IN ('Chromax') THEN 'Metabolism Support'
    WHEN name IN ('Genuphil Advance Saches') THEN 'Joint Support'
    ELSE 'General'
  END,
  updated_at = NOW()
WHERE id IN (
  '5222b617-48c7-4cae-b202-1dd9ed56c38f',  -- Osteocare 400 Mg
  '8180d3b8-747a-4b39-9937-349cca24cf7c',  -- Glutamine
  '81c4a482-fc90-4809-b6e2-428d91e64df6',  -- Chromax
  '84992f65-2bf1-43be-aaa9-346fa134a2c5',  -- Creatine
  '90a3d039-e100-4c50-abe5-2d802ee4a2df',  -- Omega-3
  '9e96b061-f2af-468c-85f6-a248514cbb96',  -- Zinc
  'a5f24d08-937c-4b8c-9089-871936373283',  -- Genuphil Advance Saches
  'a6557532-73dc-4c84-bb77-380de56c5132',  -- Centrum
  'a68358b2-47bd-4156-8713-71086e9488f2',  -- Vi-Drop
  'ba3baa3d-0846-4ca3-9634-7a02eb90b08b',  -- Vitamin D
  'cd8f2d7f-062e-4fb3-b97f-e96d1a88d524',  -- Multi-Vitamins
  'e81b4f0e-7fcc-4c82-9c82-39d0a8b3bdad',  -- Perfectil
  'ed2e3128-d410-4a3e-9b87-6bc3171d9e87'   -- Magnesium
);

-- Verify the update
SELECT id, name, food_group, subgroup 
FROM ingredients 
WHERE food_group = 'Supplements'
ORDER BY subgroup, name;
