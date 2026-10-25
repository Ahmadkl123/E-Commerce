const mysql = require('mysql2/promise');
require('dotenv').config();

const defaultImages = {
  1: '/images/products/headphones.jpg',
  2: '/images/products/keyboard.jpg',
  3: '/images/products/mouse.jpg',
  4: '/images/products/monitor.jpg',
  5: '/images/products/hub.jpg',
  6: '/images/products/watch.jpg',
  7: '/images/products/ssd.jpg',
  8: '/images/products/webcam.jpg',
  9: '/images/products/stand.jpg',
  10: '/images/products/microphone.jpg'
};

async function migrate() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'ecommerce_user';
  const password = process.env.DB_PASSWORD || 'ecommerce_password';
  const database = process.env.DB_NAME || 'ecommerce_db';

  console.log(`Connecting to database ${database} at ${host}:${port}...`);
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database
  });

  try {
    // 1. Check if image_url column exists
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'image_url'`,
      [database]
    );

    if (columns.length === 0) {
      console.log('Adding image_url column to products table...');
      await connection.query('ALTER TABLE `products` ADD COLUMN `image_url` TEXT NULL AFTER `stock`');
      console.log('✓ Column image_url added successfully.');
    } else {
      console.log('✓ Column image_url already exists in products table.');
    }

    // 2. Populate image_url for existing products if not already set
    for (const [id, imageUrl] of Object.entries(defaultImages)) {
      await connection.query(
        'UPDATE `products` SET `image_url` = ? WHERE `id` = ? AND (`image_url` IS NULL OR `image_url` = "")',
        [imageUrl, id]
      );
    }
    console.log('✓ Seeded image_url values for default catalog products.');

    const [rows] = await connection.query('SELECT id, name, image_url FROM products LIMIT 5');
    console.log('Sample products from database:', rows);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();
