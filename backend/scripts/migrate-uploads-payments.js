// Upgrades an existing database in place (no data is deleted):
//   1. products.image_url  -> MEDIUMTEXT, so uploaded photos fit in the column
//   2. orders.payment_method / payment_details / payment_reference -> checkout payments
// Safe to run more than once. Usage: npm run db:migrate
const mysql = require('mysql2/promise');
require('dotenv').config();

async function columnInfo(connection, database, table, column) {
  const [rows] = await connection.query(
    `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [database, table, column]
  );
  return rows[0] || null;
}

async function migrate() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'ecommerce_user';
  const password = process.env.DB_PASSWORD || 'ecommerce_password';
  const database = process.env.DB_NAME || 'ecommerce_db';

  console.log(`Connecting to database ${database} at ${host}:${port}...`);
  const connection = await mysql.createConnection({ host, port, user, password, database });

  try {
    // 1. Product images
    const image = await columnInfo(connection, database, 'products', 'image_url');
    if (!image) {
      await connection.query('ALTER TABLE `products` ADD COLUMN `image_url` MEDIUMTEXT NULL AFTER `stock`');
      console.log('✓ Added products.image_url (MEDIUMTEXT).');
    } else if (image.DATA_TYPE.toLowerCase() !== 'mediumtext' && image.DATA_TYPE.toLowerCase() !== 'longtext') {
      await connection.query('ALTER TABLE `products` MODIFY COLUMN `image_url` MEDIUMTEXT NULL');
      console.log(`✓ Widened products.image_url from ${image.DATA_TYPE} to MEDIUMTEXT.`);
    } else {
      console.log('✓ products.image_url is already large enough.');
    }

    // 2. Order payments
    if (!(await columnInfo(connection, database, 'orders', 'payment_method'))) {
      await connection.query('ALTER TABLE `orders` ADD COLUMN `payment_method` VARCHAR(30) NULL AFTER `status`');
      console.log('✓ Added orders.payment_method.');
    } else {
      console.log('✓ orders.payment_method already exists.');
    }
    if (!(await columnInfo(connection, database, 'orders', 'payment_details'))) {
      await connection.query('ALTER TABLE `orders` ADD COLUMN `payment_details` VARCHAR(255) NULL AFTER `payment_method`');
      console.log('✓ Added orders.payment_details.');
    } else {
      console.log('✓ orders.payment_details already exists.');
    }
    if (!(await columnInfo(connection, database, 'orders', 'payment_reference'))) {
      await connection.query('ALTER TABLE `orders` ADD COLUMN `payment_reference` VARCHAR(255) NULL AFTER `payment_details`');
      await connection.query('ALTER TABLE `orders` ADD UNIQUE KEY `uq_orders_payment_reference` (`payment_reference`)');
      console.log('✓ Added orders.payment_reference (unique).');
    } else {
      console.log('✓ orders.payment_reference already exists.');
    }

    console.log('\nMigration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

migrate();
