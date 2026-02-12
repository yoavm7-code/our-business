-- Promote the first registered user to admin
UPDATE "User" SET is_admin = true WHERE id = (
  SELECT id FROM "User" ORDER BY "createdAt" ASC LIMIT 1
);
