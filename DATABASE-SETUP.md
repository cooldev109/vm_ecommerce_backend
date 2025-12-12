# Database Setup Guide

## Current Status
✅ Prisma schema created with 14 tables
✅ Prisma Client generated
✅ Seed file created with sample data
⏳ PostgreSQL connection pending

## Prerequisites

### Windows PostgreSQL Installation

1. **Download PostgreSQL 14+**
   - Visit: https://www.postgresql.org/download/windows/
   - Download the installer for Windows
   - Run the installer

2. **Installation Steps**
   - Default port: 5432
   - Set password for `postgres` user (update `.env` file with this password)
   - Install pgAdmin 4 (included)

3. **Verify Installation**
   ```bash
   psql --version
   ```

### Alternative: Docker PostgreSQL

```bash
docker run --name vmcandles-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=vmcandles \
  -p 5432:5432 \
  -d postgres:14
```

## Database Setup Steps

### Step 1: Update .env File

Make sure your `backend/.env` has the correct database credentials:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/vmcandles
```

Replace `YOUR_PASSWORD` with your PostgreSQL password.

### Step 2: Create Database (if not exists)

Using psql:
```bash
psql -U postgres -c "CREATE DATABASE vmcandles;"
```

Or using pgAdmin 4:
- Right-click "Databases"
- Create → Database
- Name: `vmcandles`

### Step 3: Run Migrations

```bash
cd backend
npm run db:migrate
```

This will:
- Create all 14 tables
- Set up relationships and constraints
- Generate Prisma Client

### Step 4: Seed Database

```bash
npm run db:seed
```

This will populate:
- Admin user (admin@vmcandles.com / Admin123!)
- Test user (test@example.com / Test123!)
- 14 products (11 candles + 3 accessories)
- Spanish translations
- 3 sample audio tracks

### Step 5: Verify Database

```bash
npm run db:studio
```

Opens Prisma Studio at http://localhost:5555 to browse your database.

## Database Schema Overview

### 14 Tables Created

1. **users** - User accounts with authentication
2. **profiles** - User profile information
3. **addresses** - Shipping/billing addresses
4. **products** - Product catalog (candles & accessories)
5. **product_translations** - Multi-language product content
6. **carts** - Shopping cart sessions
7. **cart_items** - Items in shopping carts
8. **orders** - Order records
9. **order_items** - Line items in orders
10. **subscriptions** - Audio experience subscriptions
11. **audio_content** - Audio track metadata
12. **audio_access_keys** - Download keys for audio files
13. **invoices** - Invoice records
14. **newsletter_subscribers** - Newsletter email list

## Key Design Features

### String-based Product IDs
- Products use string IDs: '1', '2', 'acc-1'
- Matches frontend expectations exactly

### Order ID Format
- Format: 'ORD-001', 'ORD-002'
- Auto-generated from orderNumber field

### Multi-language Support
- 7 languages: ES, EN, FR, DE, PT, ZH, HI
- ProductTranslation table for localized content

### Denormalized Cart Data
- CartItem stores name, price, image
- Preserves data even if product changes

## Troubleshooting

### Error: P1000 Authentication Failed
- Check PostgreSQL is running: `pg_ctl status`
- Verify password in `.env` matches PostgreSQL user password
- Test connection: `psql -U postgres -d vmcandles`

### Error: Database does not exist
- Create database: `psql -U postgres -c "CREATE DATABASE vmcandles;"`
- Or use pgAdmin 4 to create database

### Error: Port 5432 in use
- Check if PostgreSQL is running: `netstat -an | findstr 5432`
- Stop conflicting service or change port in `.env`

## Next Steps After Database Setup

1. ✅ Run migrations: `npm run db:migrate`
2. ✅ Seed database: `npm run db:seed`
3. ✅ Verify with Prisma Studio: `npm run db:studio`
4. ✅ Test API endpoints with database connection
5. → Move to Phase 2: Authentication & Profiles

## Quick Start Commands

```bash
# After PostgreSQL is installed and running:
cd backend

# Load environment and run migration
npm run db:migrate

# Seed the database
npm run db:seed

# Open Prisma Studio
npm run db:studio

# Start development server
npm run dev
```

## Database Connection Test

Test the connection from Node.js:

```javascript
import { PrismaClient } from './src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function testConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    const userCount = await prisma.user.count();
    console.log(`📊 Users in database: ${userCount}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
}

testConnection();
```

Save as `backend/test-db.js` and run:
```bash
node test-db.js
```
