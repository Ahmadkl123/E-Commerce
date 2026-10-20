-- =============================================================================
-- Dedicated Application Database User
-- Creates a dedicated user restricted strictly to the ecommerce_db database.
-- =============================================================================

-- Create the user for both localhost and any host connection (adjust password as needed)
CREATE USER IF NOT EXISTS 'ecommerce_user'@'localhost' IDENTIFIED BY 'ecommerce_password';
CREATE USER IF NOT EXISTS 'ecommerce_user'@'%' IDENTIFIED BY 'ecommerce_password';

-- Grant required permissions strictly on ecommerce_db tables only
GRANT ALL PRIVILEGES ON `ecommerce_db`.* TO 'ecommerce_user'@'localhost';
GRANT ALL PRIVILEGES ON `ecommerce_db`.* TO 'ecommerce_user'@'%';

FLUSH PRIVILEGES;
