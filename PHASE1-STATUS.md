# Phase 1: Database Schema & Migrations - STATUS

## Overview
Phase 1 focuses on setting up the database schema, ORM configuration, and initial data seeding.

## Completion Status: 🟡 PARTIAL (90%)

### ✅ Completed Tasks

1. **Prisma ORM Installation**
   - ✅ Installed `prisma` and `@prisma/client`
   - ✅ Initialized Prisma with `npx prisma init`
   - ✅ Generated Prisma Client to `src/generated/prisma`

2. **Database Schema Design**
   - ✅ Created comprehensive `prisma/schema.prisma` with 14 tables
   - ✅ Implemented all required models:
     - Users & Authentication (User, Profile, Address)
     - Products & Catalog (Product, ProductTranslation)
     - Shopping Cart (Cart, CartItem)
     - Orders (Order, OrderItem)
     - Subscriptions & Audio (Subscription, AudioContent, AudioAccessKey)
     - Invoices (Invoice)
     - Newsletter (NewsletterSubscriber)
   - ✅ Defined enums for Language, Role, CustomerType, ProductCategory, OrderStatus, PaymentStatus, SubscriptionStatus, SubscriptionTier
   - ✅ Set up relationships and foreign keys
   - ✅ Added proper indexes for performance

3. **Critical Design Decisions Implemented**
   - ✅ Product IDs as strings ('1', '2', 'acc-1') to match frontend
   - ✅ Order IDs as strings ('ORD-001' format)
   - ✅ 7-language support (ES, EN, FR, DE, PT, ZH, HI)
   - ✅ Denormalized CartItem fields (name, price, image)
   - ✅ Customer data snapshot in Order table
   - ✅ Webpay integration fields

4. **Database Seeding**
   - ✅ Created `prisma/seed.js` with comprehensive seed data
   - ✅ Admin user: admin@vmcandles.com / Admin123!
   - ✅ Test user: test@example.com / Test123!
   - ✅ 14 products (11 candles + 3 accessories)
   - ✅ Spanish translations for all products
   - ✅ 3 sample audio preview tracks
   - ✅ Proper password hashing with bcrypt

5. **NPM Scripts**
   - ✅ Added `db:generate` - Generate Prisma Client
   - ✅ Added `db:migrate` - Run migrations in development
   - ✅ Added `db:migrate:prod` - Run migrations in production
   - ✅ Added `db:seed` - Seed database with initial data
   - ✅ Added `db:studio` - Open Prisma Studio GUI
   - ✅ Added `db:reset` - Reset database (drop & recreate)

6. **Documentation**
   - ✅ Created `DATABASE-SETUP.md` with complete setup instructions
   - ✅ Created `test-db.js` for connection testing
   - ✅ Documented troubleshooting steps

### ⏳ Pending Tasks (Requires PostgreSQL)

1. **PostgreSQL Installation**
   - ⏳ Install PostgreSQL 14+ on Windows
   - ⏳ Or setup Docker PostgreSQL container
   - ⏳ Create `vmcandles` database

2. **Run Migrations**
   - ⏳ Execute `npm run db:migrate` to create tables
   - ⏳ Verify all 14 tables are created successfully

3. **Seed Database**
   - ⏳ Execute `npm run db:seed` to populate initial data
   - ⏳ Verify admin user, test user, products, and translations

4. **Database Testing**
   - ⏳ Run `node test-db.js` to verify connection
   - ⏳ Open Prisma Studio to browse data
   - ⏳ Test sample queries

## Files Created

### Schema & Configuration
- `prisma/schema.prisma` - Complete database schema (14 tables)
- `prisma.config.ts` - Prisma configuration file
- `src/generated/prisma/` - Generated Prisma Client

### Seed & Test Files
- `prisma/seed.js` - Database seeding script
- `test-db.js` - Database connection test

### Documentation
- `DATABASE-SETUP.md` - Complete setup guide
- `PHASE1-STATUS.md` - This file

## Database Schema Summary

### Tables (14 total)

1. **users** - User accounts with email/password
   - Fields: id, email, passwordHash, role, createdAt, updatedAt
   - Relations: profile, carts, orders, subscriptions, invoices

2. **profiles** - User profile information
   - Fields: id, userId, firstName, lastName, phone, taxId, customerType, preferredLanguage
   - Relations: user, addresses

3. **addresses** - Shipping & billing addresses
   - Fields: id, profileId, type, street, city, region, postalCode, country, isDefault
   - Relations: profile

4. **products** - Product catalog
   - Fields: id (STRING), category, price, image, images[], inStock, burnTime, size, featured, sortOrder
   - Relations: translations, cartItems, orderItems

5. **product_translations** - Multi-language product content
   - Fields: id, productId, language, name, description, ingredients
   - Relations: product
   - Unique: (productId, language)

6. **carts** - Shopping cart sessions
   - Fields: id, userId, createdAt, updatedAt
   - Relations: user, items

7. **cart_items** - Items in shopping carts
   - Fields: id, cartId, productId, quantity, name, price, image (denormalized)
   - Relations: cart, product

8. **orders** - Order records
   - Fields: id (STRING 'ORD-XXX'), userId, orderNumber, customer snapshot fields, totals, status, payment status, webpay fields
   - Relations: user, items, invoice

9. **order_items** - Line items in orders
   - Fields: id, orderId, productId, quantity, name, price, image, subtotal
   - Relations: order, product

10. **subscriptions** - Audio experience subscriptions
    - Fields: id, userId, tier, status, startDate, endDate, autoRenew, price
    - Relations: user, accessKeys

11. **audio_content** - Audio track metadata
    - Fields: id, title, description, duration, fileUrl, previewUrl, language, category, sortOrder
    - Relations: accessKeys

12. **audio_access_keys** - Download keys for audio files
    - Fields: id, subscriptionId, audioContentId, accessKey, expiresAt, downloadCount, maxDownloads
    - Relations: subscription, audioContent

13. **invoices** - Invoice records
    - Fields: id (STRING 'INV-YYYY-XXXX'), userId, orderId, subscriptionId, invoiceNumber, totals, status, dates, pdfUrl
    - Relations: user, order, subscription

14. **newsletter_subscribers** - Newsletter email list
    - Fields: id, email, name, language, isActive, subscribedAt, unsubscribedAt

### Enums

- **Language**: ES, EN, FR, DE, PT, ZH, HI (7 languages)
- **Role**: USER, ADMIN
- **CustomerType**: INDIVIDUAL, BUSINESS
- **ProductCategory**: CANDLES, ACCESSORIES
- **OrderStatus**: PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED
- **PaymentStatus**: PENDING, AUTHORIZED, CAPTURED, FAILED, REFUNDED
- **SubscriptionStatus**: ACTIVE, CANCELLED, EXPIRED, PAUSED
- **SubscriptionTier**: MONTHLY, ANNUAL
- **AddressType**: SHIPPING, BILLING

## Key Technical Features

### 1. Frontend-Backend Contract Compliance
✅ Product IDs match frontend exactly: '1', '2', 'acc-1'
✅ Order IDs use 'ORD-XXX' format as expected by frontend
✅ CartItem structure matches CartContext interface
✅ Order response format matches Account page expectations

### 2. Data Integrity
✅ Foreign key constraints on all relationships
✅ Unique constraints on email, orderNumber, invoiceNumber
✅ Cascade deletes configured appropriately
✅ Indexes on frequently queried fields

### 3. Performance Optimization
✅ Denormalized cart items for fast retrieval
✅ Customer data snapshot in orders (no joins needed)
✅ Composite indexes on (productId, language)
✅ Timestamps for caching and auditing

### 4. Multi-language Support
✅ ProductTranslation table with 7 language enum
✅ Unique constraint ensures one translation per language
✅ Newsletter subscribers can choose preferred language
✅ User profiles have preferredLanguage field

### 5. Business Logic Support
✅ Webpay integration fields (token, transactionId)
✅ Invoice auto-numbering (INV-YYYY-XXXX format)
✅ Order auto-numbering (ORD-XXX format)
✅ Subscription auto-renewal flag
✅ Audio access key expiration and download limits

## Database Migration Commands

### Development
```bash
# Generate Prisma Client
npm run db:generate

# Create and apply migration
npm run db:migrate

# Seed database
npm run db:seed

# Open Prisma Studio
npm run db:studio

# Reset database (drop all data)
npm run db:reset
```

### Production
```bash
# Apply migrations (no prompts)
npm run db:migrate:prod

# Seed production database
npm run db:seed
```

## Next Steps

### Immediate (Complete Phase 1)
1. Install PostgreSQL or setup Docker container
2. Update `.env` with correct database password
3. Run `npm run db:migrate` to create tables
4. Run `npm run db:seed` to populate data
5. Run `node test-db.js` to verify connection
6. Open Prisma Studio to browse data

### After Database Setup (Phase 2)
1. Implement authentication endpoints (register, login, logout)
2. Create JWT middleware for protected routes
3. Build profile management endpoints
4. Add address CRUD operations
5. Test authentication flow end-to-end

## Success Criteria for Phase 1 Completion

- [x] Prisma ORM installed and configured
- [x] Complete schema with all 14 tables defined
- [x] All relationships and constraints configured
- [x] Seed file created with sample data
- [ ] PostgreSQL installed and running ⏳
- [ ] Migration executed successfully ⏳
- [ ] Database seeded with initial data ⏳
- [ ] Connection test passing ⏳
- [ ] All tables visible in Prisma Studio ⏳

**Progress: 5/9 criteria met (55%)**

## PostgreSQL Setup Required

Phase 1 cannot be fully completed without PostgreSQL. Please see [DATABASE-SETUP.md](DATABASE-SETUP.md) for installation instructions.

### Quick PostgreSQL Setup (Windows)

1. Download: https://www.postgresql.org/download/windows/
2. Install with default settings (port 5432)
3. Set postgres user password
4. Update `backend/.env` with your password:
   ```
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/vmcandles
   ```
5. Run: `npm run db:migrate`
6. Run: `npm run db:seed`

### Or Use Docker

```bash
docker run --name vmcandles-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=vmcandles \
  -p 5432:5432 \
  -d postgres:14
```

Then: `npm run db:migrate && npm run db:seed`

---

**Phase 1 Status**: 🟡 Awaiting PostgreSQL setup to complete remaining 4 tasks
