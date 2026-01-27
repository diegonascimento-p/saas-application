CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cognito_user_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    user_role VARCHAR(50) DEFAULT 'standard',
    profile_data JSONB DEFAULT '{"name": "User", "department": "General"}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_key VARCHAR(500),
    category VARCHAR(100),
    price DECIMAL(10, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (name, description, image_key, category, price) VALUES
('Laptop Pro', 'High-performance business laptop', 'products/laptop.jpg', 'Electronics', 1299.99),
('Wireless Headphones', 'Noise cancelling audio', 'products/headphones.jpg', 'Audio', 249.99),
('Smart Watch', 'Fitness and notifications', 'products/watch.jpg', 'Wearables', 399.99),
('Desk Lamp', 'Adjustable LED lighting', 'products/lamp.jpg', 'Home', 89.99),
('Backpack', 'Water-resistant daily use', 'products/backpack.jpg', 'Accessories', 79.99)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_cognito_id ON users(cognito_user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);