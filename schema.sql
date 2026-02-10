-- D1 schema for BracketologyBuilder (v26)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  pass_salt TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brackets (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS feature_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bracket_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  caption TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  created_at TEXT NOT NULL,
  approved_at TEXT,
  FOREIGN KEY(bracket_id) REFERENCES brackets(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_brackets_user ON brackets(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_status ON feature_requests(status);


-- v31 (optional): tournament results + challenge leaderboards
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  stage TEXT NOT NULL, -- r64|r32|s16|e8|ff|final
  region TEXT, -- SOUTH|EAST|WEST|MIDWEST or NULL for final rounds
  game_index INTEGER NOT NULL,
  team1_json TEXT,
  team2_json TEXT,
  winner_json TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS challenge_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  challenge_type TEXT NOT NULL, -- best|worst
  stage TEXT NOT NULL, -- pre|r16|f4
  bracket_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(bracket_id) REFERENCES brackets(id)
);
CREATE INDEX IF NOT EXISTS idx_challenge_type_stage ON challenge_entries(challenge_type, stage);




-- v32: groups + site stats + milestones + settings

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL, -- best|worst
  name TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 0,
  join_password_hash TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY(created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_groups_challenge_public ON groups(challenge, is_public);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY(group_id) REFERENCES groups(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value_text TEXT
);

CREATE TABLE IF NOT EXISTS milestones (
  key TEXT PRIMARY KEY,
  fired_at TEXT NOT NULL
);


-- v35: group size tiers
ALTER TABLE groups ADD COLUMN max_members INTEGER NOT NULL DEFAULT 6;
ALTER TABLE groups ADD COLUMN tier_price INTEGER NOT NULL DEFAULT 0;
ALTER TABLE groups ADD COLUMN upgraded_at TEXT;
