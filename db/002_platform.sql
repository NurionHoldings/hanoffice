-- Review of 001_core.sql: branches, customers, orders, contracts, payments,
-- payment_events and audit_events are present. Products, stored quotes, sessions,
-- roles and commercial terms were missing. Checkout and LIVE payments stay blocked.
BEGIN;
CREATE TABLE products(id text PRIMARY KEY,name text NOT NULL,active boolean NOT NULL DEFAULT true);
CREATE TABLE price_books(version text PRIMARY KEY,illustrative boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE customers ADD COLUMN email text;
ALTER TABLE customers ADD COLUMN password_hash text;
ALTER TABLE customers ADD COLUMN display_name text;
ALTER TABLE customers ADD COLUMN role text NOT NULL DEFAULT 'customer';
ALTER TABLE customers ADD CONSTRAINT customers_role_check CHECK (role IN ('customer','operator'));
CREATE UNIQUE INDEX customers_email_lower ON customers (lower(email));
CREATE TABLE sessions(id uuid PRIMARY KEY,customer_id uuid NOT NULL REFERENCES customers(id),token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE login_attempts(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,email text NOT NULL,succeeded boolean NOT NULL,attempted_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX login_attempts_email_time ON login_attempts(email,attempted_at);
CREATE TABLE quotes(id uuid PRIMARY KEY,public_number text NOT NULL UNIQUE,customer_id uuid REFERENCES customers(id),branch_id text NOT NULL REFERENCES branches(id),product_id text NOT NULL REFERENCES products(id),customer_type text NOT NULL CHECK (customer_type IN ('individual','corporate')),months integer NOT NULL CHECK (months IN (1,3,6,12,24)),mail boolean NOT NULL,meeting boolean NOT NULL,price_version text NOT NULL REFERENCES price_books(version),monthly bigint NOT NULL CHECK (monthly>0),subtotal bigint NOT NULL CHECK (subtotal>0),vat bigint NOT NULL CHECK (vat>=0),total bigint NOT NULL CHECK (total>0),currency text NOT NULL DEFAULT 'KRW' CHECK (currency='KRW'),illustrative boolean NOT NULL DEFAULT true,can_checkout boolean NOT NULL DEFAULT false CHECK (can_checkout=false),expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX quotes_customer ON quotes(customer_id);
ALTER TABLE orders ADD COLUMN quote_id uuid UNIQUE REFERENCES quotes(id);
ALTER TABLE orders ADD COLUMN months integer;
ALTER TABLE orders ADD COLUMN mail boolean;
ALTER TABLE orders ADD COLUMN meeting boolean;
ALTER TABLE contracts ADD COLUMN quote_id uuid REFERENCES quotes(id);
ALTER TABLE contracts ADD COLUMN legally_executed boolean NOT NULL DEFAULT false CHECK (legally_executed=false);
ALTER TABLE payments ADD CONSTRAINT payments_live_blocked CHECK (environment='TEST');
INSERT INTO products(id,name) VALUES ('virtual-office','비상주사무실');
INSERT INTO price_books(version,illustrative) VALUES ('demo-2026-11-24',true);
COMMIT;
