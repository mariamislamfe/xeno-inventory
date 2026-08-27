-- ============================================================
-- XENO Inventory OS — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. Inventory Transactions ─────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('in', 'out')),
  sku           TEXT NOT NULL,
  product_name  TEXT NOT NULL,
  shopify_product_id BIGINT,
  shopify_variant_id BIGINT,
  category      TEXT,
  quantity      INT  NOT NULL CHECK (quantity > 0),
  note          TEXT,
  source        TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'shopify_order', 'adjustment', 'return')),
  shopify_order_id BIGINT,
  created_by    TEXT DEFAULT 'system',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast SKU lookups
CREATE INDEX IF NOT EXISTS idx_txn_sku        ON inventory_transactions (sku);
CREATE INDEX IF NOT EXISTS idx_txn_created_at ON inventory_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_type       ON inventory_transactions (type);

-- ── 2. Activity Log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('order', 'inventory', 'shipment', 'system', 'user', 'whatsapp')),
  action     TEXT NOT NULL,
  detail     TEXT,
  entity_id  TEXT,   -- e.g. shopify order id, product sku
  user_name  TEXT DEFAULT 'النظام',
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_type       ON activity_log (type);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_log (created_at DESC);

-- ── 3. WhatsApp Messages ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_order_id BIGINT NOT NULL,
  order_number     TEXT NOT NULL,
  phone            TEXT NOT NULL,
  customer_name    TEXT,
  template         TEXT NOT NULL,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  message_id       TEXT,   -- WhatsApp message ID from API
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_order    ON whatsapp_messages (shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_wa_status   ON whatsapp_messages (status);

-- ── 4. Shipments (supplement Shopify fulfillments) ───────────
CREATE TABLE IF NOT EXISTS shipments (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_order_id BIGINT NOT NULL,
  order_number     TEXT NOT NULL,
  tracking_number  TEXT,
  provider         TEXT DEFAULT 'J&T Express',
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 'failed')),
  customer_name    TEXT,
  phone            TEXT,
  address          TEXT,
  city             TEXT,
  governorate      TEXT,
  cod_amount       NUMERIC(10,2) DEFAULT 0,
  notes            TEXT,
  label_printed    BOOLEAN DEFAULT FALSE,
  shipped_at       TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ship_order   ON shipments (shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_ship_status  ON shipments (status);
CREATE INDEX IF NOT EXISTS idx_ship_tracking ON shipments (tracking_number);

-- ── 5. Webhooks log (for debugging) ──────────────────────────
CREATE TABLE IF NOT EXISTS webhook_log (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic      TEXT NOT NULL,   -- e.g. 'orders/create'
  shop       TEXT NOT NULL,
  payload    JSONB DEFAULT '{}',
  processed  BOOLEAN DEFAULT FALSE,
  error      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_topic ON webhook_log (topic);
CREATE INDEX IF NOT EXISTS idx_webhook_processed ON webhook_log (processed);

-- ── Helper: auto-update updated_at ───────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Done! Tables created:
--   inventory_transactions  → stock in/out log
--   activity_log            → all system events
--   whatsapp_messages       → WA message status tracking
--   shipments               → shipping management
--   webhook_log             → Shopify webhook debugging
-- ============================================================
