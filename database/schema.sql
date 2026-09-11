CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rank INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO plans (id, name, rank) VALUES
  ('free', 'Free', 0), ('professional', 'Professional', 1), ('investor', 'Investor', 2)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'free' CHECK (role IN ('free', 'professional', 'investor', 'admin')),
  plan_id TEXT NOT NULL DEFAULT 'free' REFERENCES plans(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions(token_hash);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_licences (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  licence_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, licence_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  licence_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_history (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  licence_id TEXT NOT NULL,
  score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mining_records (
  id UUID PRIMARY KEY,
  licence_no TEXT NOT NULL,
  licence_no_normalized TEXT NOT NULL UNIQUE,
  operator TEXT NOT NULL,
  state TEXT NOT NULL,
  lga TEXT,
  commodities JSONB NOT NULL DEFAULT '[]'::jsonb,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  title_type TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  area_m2 DOUBLE PRECISION,
  issue_date DATE,
  expiry_date DATE,
  source TEXT,
  source_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  last_verified_at DATE,
  geological_notes TEXT,
  infrastructure_notes TEXT,
  risk_notes TEXT,
  ai_score INTEGER CHECK (ai_score BETWEEN 0 AND 100),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mining_records_verification_status_idx ON mining_records(verification_status);

CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY,
  filename TEXT NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS managed_data_sources (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  authority TEXT,
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gps_field_points (
  id UUID PRIMARY KEY,
  point_hash TEXT NOT NULL UNIQUE,
  field_site_name TEXT,
  sample_id TEXT,
  mineral_observed TEXT,
  field_notes TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  gps_source TEXT NOT NULL DEFAULT 'file_import',
  source_format TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  altitude_m DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gps_field_points_coordinates_idx ON gps_field_points(latitude, longitude);
CREATE INDEX IF NOT EXISTS gps_field_points_verification_status_idx ON gps_field_points(verification_status);
