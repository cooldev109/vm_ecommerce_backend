/**
 * Script to fix failed Prisma migration in production database
 * This script deletes the failed migration record so it can be re-run with the corrected SQL
 */

import pkg from 'pg';
const { Client } = pkg;

async function fixFailedMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Required for Render PostgreSQL
    },
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Check current migrations
    console.log('📋 Current migrations:');
    const checkResult = await client.query(
      `SELECT migration_name, finished_at, started_at, applied_steps_count
       FROM _prisma_migrations
       ORDER BY started_at DESC
       LIMIT 5`
    );
    console.table(checkResult.rows);

    // Delete the failed migration
    const migrationName = '20251212120000_add_wishlist_and_inventory';
    console.log(`\n🗑️  Deleting failed migration: ${migrationName}...`);

    const deleteResult = await client.query(
      `DELETE FROM _prisma_migrations
       WHERE migration_name = $1`,
      [migrationName]
    );

    if (deleteResult.rowCount > 0) {
      console.log(`✅ Deleted ${deleteResult.rowCount} migration record(s)\n`);
    } else {
      console.log(`⚠️  No migration found with name: ${migrationName}\n`);
    }

    // Verify deletion
    console.log('📋 Updated migrations list:');
    const verifyResult = await client.query(
      `SELECT migration_name, finished_at, started_at, applied_steps_count
       FROM _prisma_migrations
       ORDER BY started_at DESC
       LIMIT 5`
    );
    console.table(verifyResult.rows);

    console.log('\n✨ Migration fix completed successfully!');
    console.log('👉 Now you can run: npx prisma migrate deploy');

  } catch (error) {
    console.error('❌ Error fixing migration:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

fixFailedMigration();
