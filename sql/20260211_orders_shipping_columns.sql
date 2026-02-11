create table if not exists public.orders (
  id bigserial primary key,
  stripe_session_id text not null unique,
  customer_email text,
  amount_total bigint,
  currency text,
  status text not null,
  shipping_provider text,
  shipping_price numeric(10,2),
  tracking_number text,
  label_url text,
  shipment_id text,
  items jsonb,
  error_details text,
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
