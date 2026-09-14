-- Run this in Supabase SQL Editor if the shipments table already exists
-- Removes any duplicate rows first, then adds the UNIQUE constraint

-- Step 1: Delete duplicate shipments (keep the one with a tracking number, else latest)
DELETE FROM shipments a
USING shipments b
WHERE a.id < b.id
  AND a.shopify_order_id = b.shopify_order_id
  AND (a.tracking_number IS NULL OR b.tracking_number IS NOT NULL);

-- Step 2: Add unique constraint
ALTER TABLE shipments
  ADD CONSTRAINT shipments_shopify_order_id_unique UNIQUE (shopify_order_id);
