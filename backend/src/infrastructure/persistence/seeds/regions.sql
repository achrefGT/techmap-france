-- Seed: French Regions
-- Based on the 13 metropolitan regions + overseas territories

INSERT INTO regions (name, code, full_name, population, job_count, created_at, updated_at) VALUES
-- Metropolitan France (13 regions)
('Île-de-France', 'IDF', 'Région Île-de-France', 12278210, 0, NOW(), NOW()),
('Auvergne-Rhône-Alpes', 'ARA', 'Région Auvergne-Rhône-Alpes', 8032377, 0, NOW(), NOW()),
('Nouvelle-Aquitaine', 'NAQ', 'Région Nouvelle-Aquitaine', 6033952, 0, NOW(), NOW()),
('Occitanie', 'OCC', 'Région Occitanie', 5973969, 0, NOW(), NOW()),
('Hauts-de-France', 'HDF', 'Région Hauts-de-France', 5962662, 0, NOW(), NOW()),
('Provence-Alpes-Côte d''Azur', 'PAC', 'Région Provence-Alpes-Côte d''Azur', 5081101, 0, NOW(), NOW()),
('Grand Est', 'GES', 'Région Grand Est', 5511747, 0, NOW(), NOW()),
('Pays de la Loire', 'PDL', 'Région Pays de la Loire', 3832120, 0, NOW(), NOW()),
('Bretagne', 'BRE', 'Région Bretagne', 3373835, 0, NOW(), NOW()),
('Normandie', 'NOR', 'Région Normandie', 3303500, 0, NOW(), NOW()),
('Bourgogne-Franche-Comté', 'BFC', 'Région Bourgogne-Franche-Comté', 2783039, 0, NOW(), NOW()),
('Centre-Val de Loire', 'CVL', 'Région Centre-Val de Loire', 2570548, 0, NOW(), NOW()),
('Corse', 'COR', 'Région Corse', 343701, 0, NOW(), NOW())

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  full_name = EXCLUDED.full_name,
  population = EXCLUDED.population,
  updated_at = NOW();

-- Notes:
-- - Population data is approximate (2023 estimates)
-- - job_count starts at 0 and will be updated by analytics services
-- - Overseas territories (Guadeloupe, Martinique, etc.) can be added later if needed
-- - Remote jobs will be tracked separately (no specific region)