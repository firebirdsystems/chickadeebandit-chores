SELECT
  id,
  name,
  points,
  assigned_to,
  frequency,
  created_at
FROM app_chore_tracker__chores
ORDER BY name, id
LIMIT 200
-- app_chore_tracker__chores_name_idx serves this ORDER BY. `name` is plaintext
-- only because this app sets db_encryption "off" — see the migration.
