-- Produits / coûts d'achat saisis manuellement
CREATE TABLE IF NOT EXISTS products (
  asin TEXT PRIMARY KEY,
  title TEXT,
  brand TEXT,
  purchase_price DECIMAL(10,2),
  supplier TEXT,
  lead_time_days INT DEFAULT 7,
  reorder_buffer_days INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Commandes syncées depuis SP-API
CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  asin TEXT REFERENCES products(asin),
  quantity INT,
  selling_price DECIMAL(10,2),
  fba_fee DECIMAL(10,2),
  referral_fee DECIMAL(10,2),
  net_revenue DECIMAL(10,2),
  order_date TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snapshot stock FBA (mis à jour à chaque sync)
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asin TEXT REFERENCES products(asin),
  quantity_available INT,
  quantity_inbound INT,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vue calculée rentabilité par ASIN
CREATE OR REPLACE VIEW asin_profitability AS
SELECT
  p.asin,
  p.title,
  p.brand,
  p.purchase_price,
  AVG(o.selling_price) AS avg_selling_price,
  AVG(o.fba_fee) AS avg_fba_fee,
  AVG(o.referral_fee) AS avg_referral_fee,
  AVG(o.net_revenue) - p.purchase_price AS avg_margin_eur,
  ROUND(((AVG(o.net_revenue) - p.purchase_price) / NULLIF(p.purchase_price, 0)) * 100, 2) AS roi_pct,
  COUNT(o.order_id) AS total_units_sold,
  SUM(o.net_revenue - p.purchase_price) AS total_profit
FROM products p
LEFT JOIN orders o ON p.asin = o.asin
GROUP BY p.asin, p.title, p.brand, p.purchase_price;

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_orders_asin ON orders(asin);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_inventory_asin ON inventory_snapshots(asin);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshot_at ON inventory_snapshots(snapshot_at);
