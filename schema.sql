CREATE TABLE IF NOT EXISTS restaurants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    paybill TEXT,
    delivery_fee REAL DEFAULT 150,
    free_delivery_threshold REAL DEFAULT 1000,
    is_active BOOLEAN DEFAULT 1,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    item_description TEXT,
    price REAL NOT NULL,
    category TEXT,
    is_available BOOLEAN DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    items TEXT NOT NULL,
    subtotal REAL NOT NULL,
    delivery_fee REAL NOT NULL,
    total REAL NOT NULL,
    what3words TEXT NOT NULL,
    special_instructions TEXT,
    status TEXT DEFAULT 'pending',
    payment_confirmed BOOLEAN DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);

CREATE INDEX idx_menu_restaurant ON menu_items(restaurant_id);
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_status ON orders(restaurant_id);
