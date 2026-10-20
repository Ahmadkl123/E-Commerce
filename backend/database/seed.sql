-- =============================================================================
-- Seed Sample Data
-- Includes 1 admin, 1 customer, and 10 representative e-commerce products.
-- Plain text passwords:
--   - admin@example.com    -> admin123
--   - customer@example.com -> customer123
-- =============================================================================

USE `ecommerce_db`;

-- Insert initial Users
-- Password hashes generated with bcrypt (cost factor = 10)
INSERT INTO `users` (`id`, `email`, `password_hash`, `role`) VALUES
(1, 'admin@example.com', '$2b$10$4YVF4AvWfGho3p8nNJ8BjOKda1F6yiIOzlA/7IGdBbj.5cduhi7dS', 'admin'),
(2, 'customer@example.com', '$2b$10$O8NncLRiXVjtkxh3exCRje6XgBMDnHkFFxOLbGATA9n7fmiSGsFU.', 'customer')
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

-- Insert 10 Sample Products
INSERT INTO `products` (`id`, `name`, `description`, `price`, `stock`) VALUES
(1, 'Wireless Noise-Canceling Headphones', 'Premium over-ear headphones with 30-hour battery life and active noise cancellation.', 149.99, 45),
(2, 'Mechanical Gaming Keyboard', 'RGB backlit mechanical keyboard with tactile blue switches and detachable USB-C cable.', 79.99, 30),
(3, 'Ergonomic Wireless Mouse', 'Precision optical mouse with customizable shortcut buttons and ergonomic thumb rest.', 39.50, 60),
(4, 'Ultra-Wide Curved Gaming Monitor 34-inch', '144Hz refresh rate, 1ms response time, WQHD 3440x1440 resolution HDR display.', 429.00, 15),
(5, 'USB-C Multi-Port Hub Adapter', '7-in-1 hub with 4K HDMI, 3x USB 3.0, 100W Power Delivery, SD/TF card reader.', 29.99, 100),
(6, 'Smart Fitness Watch', 'Waterproof fitness tracker with heart rate monitor, sleep tracking, and built-in GPS.', 89.95, 40),
(7, 'External Portable SSD 1TB', 'High-speed NVMe portable solid-state drive with read speeds up to 1050 MB/s.', 109.99, 25),
(8, 'HD Webcam 1080p with Privacy Shutter', 'Full HD 60fps streaming webcam with dual noise-reducing stereo microphones.', 49.99, 50),
(9, 'Adjustable Laptop Stand', 'Foldable aluminum laptop riser with heat-dissipation ventilation for 10-17 inch laptops.', 24.99, 80),
(10, 'Studio Condenser Microphone', 'Cardioid USB microphone with boom arm, shock mount, and pop filter for podcasting.', 64.95, 20)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `price` = VALUES(`price`),
  `stock` = VALUES(`stock`);
