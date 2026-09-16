-- SmartKhum database schema

CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_name TEXT,
  description TEXT NOT NULL,
  category TEXT NOT NULL,          -- water, road, health, environment, other
  priority TEXT NOT NULL,          -- High, Medium, Low
  status TEXT NOT NULL DEFAULT 'Pending',  -- Pending, In Progress, Resolved
  latitude REAL,
  longitude REAL,
  village TEXT,
  photo_data TEXT,                 -- base64 encoded photo (optional)
  input_method TEXT DEFAULT 'text',-- voice, photo, text
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (issue_id) REFERENCES issues(id)
);

CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
