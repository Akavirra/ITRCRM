-- Create lesson change logs table
CREATE TABLE IF NOT EXISTS lesson_change_logs (
  id SERIAL PRIMARY KEY,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  field_name VARCHAR(50) NOT NULL, -- 'topic' or 'notes'
  old_value TEXT,
  new_value TEXT,
  changed_by INTEGER REFERENCES users(id),
  changed_by_name VARCHAR(255), -- Store name for cases when user might be deleted
  changed_by_telegram_id VARCHAR(50), -- Store Telegram ID for Telegram users
  changed_via VARCHAR(20) NOT NULL DEFAULT 'admin', -- 'admin' or 'telegram'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries by lesson_id
CREATE INDEX IF NOT EXISTS idx_lesson_change_logs_lesson_id ON lesson_change_logs(lesson_id);

-- Add index for created_at for sorting
CREATE INDEX IF NOT EXISTS idx_lesson_change_logs_created_at ON lesson_change_logs(created_at DESC);
