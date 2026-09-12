-- Run this SQL in Supabase SQL Editor to enable the Operations Center
-- Supabase → SQL Editor → New Query → paste this → Run

CREATE TABLE IF NOT EXISTS xeno_ops (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_order_id  BIGINT      UNIQUE NOT NULL,
  order_number      TEXT        NOT NULL,
  customer_name     TEXT,
  phone             TEXT,
  total             NUMERIC,
  op_status         TEXT        NOT NULL DEFAULT 'pending',
  postponed_until   TIMESTAMPTZ,
  inquiry_type      TEXT,
  internal_note     TEXT,
  items_override    JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast status filtering
CREATE INDEX IF NOT EXISTS xeno_ops_status_idx ON xeno_ops (op_status);
CREATE INDEX IF NOT EXISTS xeno_ops_postponed_idx ON xeno_ops (postponed_until) WHERE op_status = 'postponed';

-- op_status values: pending | confirmed | postponed | cancelled | inquiry

-- Settings key-value store (used for notifications last-read timestamp etc.)
CREATE TABLE IF NOT EXISTS xeno_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
