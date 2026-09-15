CREATE TYPE "order_status" AS ENUM (
  'pending',
  'confirmed',
  'cancelled'
);

CREATE TABLE "users" (
  "id" integer UNIQUE PRIMARY KEY,
  "email" varchar,
  "password_hash" varchar,
  "created_at" timestamp,
  "updated_at" timestamp
);

CREATE TABLE "products" (
  "id" integer UNIQUE PRIMARY KEY,
  "name" varchar,
  "price" integer,
  "stock_quantity" integer,
  "created_at" timestamp,
  "updated_at" timestamp
);

CREATE TABLE "orders" (
  "id" integer UNIQUE PRIMARY KEY,
  "user_id" integer NOT NULL,
  "status" order_status NOT NULL DEFAULT 'pending',
  "total_price" integer,
  "idempotency_key" varchar UNIQUE NOT NULL,
  "stock_quantity" integer,
  "created_at" timestamp,
  "updated_at" timestamp
);

CREATE TABLE "order_items" (
  "id" integer UNIQUE PRIMARY KEY,
  "order_id" integer NOT NULL,
  "product_id" integer NOT NULL,
  "product_quantity" integer,
  "unit_price" integer
);

ALTER TABLE "orders" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "order_items" ADD FOREIGN KEY ("order_id") REFERENCES "orders" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "order_items" ADD FOREIGN KEY ("product_id") REFERENCES "products" ("id") DEFERRABLE INITIALLY IMMEDIATE;
