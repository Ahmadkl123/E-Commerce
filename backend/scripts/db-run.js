const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runSqlFile(connection, filePath) {
  console.log(`Executing ${path.basename(filePath)}...`);
  const sql = fs.readFileSync(filePath, 'utf8');
  await connection.query(sql);
  console.log(`✓ Successfully executed ${path.basename(filePath)}`);
}

async function main() {
  const mode = process.argv[2] || 'setup'; // 'setup' or 'reset'
  
  // Connect to MySQL server as root (or DB_USER if configured)
  const rootUser = process.env.DB_ROOT_USER || 'root';
  const rootPassword = process.env.DB_ROOT_PASSWORD !== undefined ? process.env.DB_ROOT_PASSWORD : '';
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;

  console.log(`Connecting to MySQL at ${host}:${port} as ${rootUser}...`);
  const connection = await mysql.createConnection({
    host,
    port,
    user: rootUser,
    password: rootPassword,
    multipleStatements: true
  });

  try {
    const dbDir = path.join(__dirname, '..', 'database');
    
    // Always run schema.sql first (creates DB & tables)
    await runSqlFile(connection, path.join(dbDir, 'schema.sql'));

    if (mode === 'setup') {
      // Create dedicated application user and grant permissions
      await runSqlFile(connection, path.join(dbDir, 'user.sql'));
    }

    // Seed sample data (users & products)
    await runSqlFile(connection, path.join(dbDir, 'seed.sql'));

    console.log('\nDatabase setup completed successfully!');
  } catch (err) {
    console.error('\nDatabase setup failed:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
