-- Make attendance status nullable to support individual lessons without auto-marking
ALTER TABLE attendance ALTER COLUMN status DROP NOT NULL;
ALTER TABLE attendance ALTER COLUMN status SET DEFAULT NULL;
