```SQL
Table users {
  id integer [unique, primary key]
  email varchar
  password_hash varchar
  created_at timestamp
  updated_at timestamp
}


Table products {
  id integer [unique, primary key]
  name varchar
  price integer
  stock_quantity integer
  created_at timestamp
  updated_at timestamp
}

enum order_status {
  pending
  confirmed
  cancelled
}

Table orders {
  id integer [unique, primary key]
  user_id integer [not null]
  status order_status [default: 'pending', not null]
  total_price integer
  idempotency_key varchar [unique, not null]
  stock_quantity integer
  created_at timestamp
  updated_at timestamp
}

Table order_items{
  id integer [unique, primary key]
  order_id integer [not null]
  product_id integer [not null]
  product_quantity integer
  unit_price integer
}

Ref: users.id <? orders.user_id

Ref: orders.id <? order_items.order_id

Ref: products.id <? order_items.product_id
```