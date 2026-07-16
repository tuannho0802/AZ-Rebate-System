const { Client } = require('pg');

async function createDbs() {
  const client = new Client({
    connectionString: "postgresql://postgres:postgres@localhost:5432/postgres?schema=public",
  });
  await client.connect();

  try {
    // Terminate connections
    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname IN ('template1', 'rebate_system_db', 'rebate_shadow_db')
        AND pid <> pg_backend_pid();
    `);

    // Drop and create databases
    await client.query(`DROP DATABASE IF EXISTS rebate_system_db`);
    await client.query(`CREATE DATABASE rebate_system_db ENCODING 'UTF8' TEMPLATE = template0`);
    console.log('Created rebate_system_db with UTF8');

    await client.query(`DROP DATABASE IF EXISTS rebate_shadow_db`);
    await client.query(`CREATE DATABASE rebate_shadow_db ENCODING 'UTF8' TEMPLATE = template0`);
    console.log('Created rebate_shadow_db with UTF8');

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

createDbs();
