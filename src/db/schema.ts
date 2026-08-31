export const CREATE_POST_REQUESTS_TABLE = `
CREATE TABLE IF NOT EXISTS post_requests (
  id TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  discord_channel_id TEXT NOT NULL,
  discord_message_id TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  slug TEXT NOT NULL,
  file_path TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  pull_number INTEGER NOT NULL,
  pull_url TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;
