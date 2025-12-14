/**
 * Auto-seed utility for production deployment
 * Checks if database is empty and runs seed script if needed
 */

import { PrismaClient } from '../generated/prisma/index.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

/**
 * Check if database needs seeding
 */
async function needsSeeding() {
  try {
    // Check if there are any users in the database
    const userCount = await prisma.user.count();

    // If no users exist, database needs seeding
    return userCount === 0;
  } catch (error) {
    logger.error('Error checking if database needs seeding:', error);
    return false;
  }
}

/**
 * Run the seed script
 */
async function runSeed() {
  return new Promise((resolve, reject) => {
    logger.info('🌱 Starting automatic database seeding...');

    const seedPath = join(__dirname, '../../prisma/seed.js');
    const seedProcess = spawn('node', [seedPath], {
      stdio: 'inherit',
      env: { ...process.env }
    });

    seedProcess.on('close', (code) => {
      if (code === 0) {
        logger.info('✅ Database seeding completed successfully');
        resolve();
      } else {
        logger.error(`❌ Database seeding failed with code ${code}`);
        reject(new Error(`Seed process exited with code ${code}`));
      }
    });

    seedProcess.on('error', (error) => {
      logger.error('❌ Error running seed script:', error);
      reject(error);
    });
  });
}

/**
 * Auto-seed if database is empty
 * Safe to run on every startup
 */
export async function autoSeedIfNeeded() {
  try {
    const shouldSeed = await needsSeeding();

    if (shouldSeed) {
      logger.info('📦 Empty database detected, running auto-seed...');
      await runSeed();
    } else {
      logger.info('✅ Database already seeded, skipping auto-seed');
    }
  } catch (error) {
    logger.error('❌ Auto-seed error:', error);
    // Don't throw - let the server start even if seeding fails
  } finally {
    await prisma.$disconnect();
  }
}
