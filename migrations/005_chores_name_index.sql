-- all_chores.sql (the AI read export) orders by `name` and caps at 200, so
-- without an index every chore was read and sorted in a temp b-tree just to
-- return the first page — and the 200 it returned were whatever the sort
-- happened to produce.
--
-- `name` is orderable here because this app sets `db_encryption: "off"`, so its
-- columns are stored in the clear. In an app that encrypts (the default), an
-- index on `name` would order AES ciphertext and be worse than useless. If this
-- app ever turns encryption on, drop this index and sort after decrypt instead.
--
-- `id` is appended to break ties deterministically, so the LIMIT returns a
-- stable page rather than an arbitrary one among equal names.
CREATE INDEX IF NOT EXISTS app_chore_tracker__chores_name_idx
  ON app_chore_tracker__chores (name, id);
