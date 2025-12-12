# V&M Candle Experience - Backend API

Backend REST API for the V&M Candle Experience e-commerce platform.

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **ORM**: Prisma
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Validation**: Zod
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate Limiting
- **Payment Gateway**: Webpay (Transbank)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ installed and running
- npm or yarn package manager

### Installation

1. Install dependencies:
```bash
npm install
```

2. Environment variables are pre-configured in `.env`
   - Update `DATABASE_URL` with your PostgreSQL password
   - Default: `postgresql://postgres:postgres@localhost:5432/vmcandles`

3. Install PostgreSQL (if not installed):
   - **Windows**: Download from https://www.postgresql.org/download/windows/
   - **Docker**: `docker run --name vmcandles-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vmcandles -p 5432:5432 -d postgres:14`
   - See [DATABASE-SETUP.md](DATABASE-SETUP.md) for detailed instructions

4. Run database migrations:
```bash
npm run db:migrate
```

5. Seed the database:
```bash
npm run db:seed
```

This will create:
- Admin user: `admin@vmcandles.com` / `Admin123!`
- Test user: `test@example.com` / `Test123!`
- 14 products (11 candles + 3 accessories)
- Spanish translations
- 3 sample audio tracks

### Development

Start the development server with auto-reload:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Production

Start the production server:
```bash
npm start
```

## API Endpoints

### Health Check
- `GET /api/health` - Health check endpoint

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Products
- `GET /api/products` - List all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/admin/products` - Create product (admin)
- `PUT /api/admin/products/:id` - Update product (admin)

### Cart
- `GET /api/cart` - Get user's cart
- `POST /api/cart/items` - Add item to cart
- `PUT /api/cart/items/:id` - Update cart item
- `DELETE /api/cart/items/:id` - Remove cart item

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders` - List user's orders
- `GET /api/orders/:id` - Get order by ID

### Payments
- `POST /api/payments/webpay/init` - Initialize payment
- `POST /api/payments/webpay/callback` - Webpay callback

### Subscriptions
- `GET /api/subscriptions/plans` - List subscription plans
- `POST /api/subscriptions` - Create subscription
- `GET /api/subscriptions/me` - Get user's subscription

### Audio
- `GET /api/audio` - List audio content
- `GET /api/audio/:id/stream` - Get audio stream URL

### Newsletter
- `POST /api/newsletter/subscribe` - Subscribe to newsletter

## Environment Variables

See `.env.example` for all required environment variables.

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── logger.js    # Winston logging config
│   │   └── database.js  # PostgreSQL connection pool
│   ├── controllers/     # Route controllers (Phase 2+)
│   ├── middleware/      # Custom middleware (Phase 2+)
│   ├── routes/          # Route definitions
│   │   └── health.js    # Health check endpoint
│   ├── services/        # Business logic (Phase 2+)
│   ├── utils/           # Utility functions (Phase 2+)
│   ├── generated/       # Generated Prisma Client
│   │   └── prisma/      # Prisma types and client
│   └── index.js         # Entry point
├── prisma/
│   ├── schema.prisma    # Database schema (14 tables)
│   └── seed.js          # Database seed file
├── logs/                # Application logs
├── tests/               # Test files (Phase 9)
├── .env                 # Environment variables
├── test-db.js           # Database connection test
├── DATABASE-SETUP.md    # Database setup guide
├── PHASE0-COMPLETE.md   # Phase 0 completion doc
├── PHASE1-STATUS.md     # Phase 1 status doc
└── package.json         # Dependencies
```

## Development Phases

- [x] **Phase 0: Setup** (Complete) - See [PHASE0-COMPLETE.md](PHASE0-COMPLETE.md)
  - ✅ Express.js server with security middleware
  - ✅ Logger configuration (Winston)
  - ✅ Database connection pool
  - ✅ Health check endpoint

- [x] **Phase 1: Database Schema** (✅ COMPLETE) - See [PHASE1-COMPLETE.md](PHASE1-COMPLETE.md)
  - ✅ Prisma ORM setup
  - ✅ 14-table schema designed
  - ✅ Migrations executed
  - ✅ Database seeded (2 users, 14 products, 3 audio tracks)
  - ✅ All tests passing

- [x] **Phase 2: Authentication & Profiles** (✅ COMPLETE) - See [PHASE2-COMPLETE.md](PHASE2-COMPLETE.md)
  - ✅ Register, login, logout endpoints
  - ✅ JWT middleware
  - ✅ Profile management
  - ✅ Address CRUD
  - ✅ All tests passing (15/15)

- [ ] **Phase 3: Products & Catalog** (Days 6-7)
  - Product listing with filtering
  - Multi-language support
  - Product detail endpoint

- [ ] **Phase 4: Cart & Orders** (Days 8-9)
  - Cart management
  - Order creation
  - Order history

- [ ] **Phase 5: Payments & Invoices** (Days 10-12)
  - Webpay integration
  - Invoice generation
  - Payment webhook

- [ ] **Phase 6: Subscriptions & Audio** (Days 13-15)
  - Subscription plans
  - Audio content access
  - Download key management

- [ ] **Phase 7: Admin CMS** (Days 16-17)
  - Product management
  - Order management
  - Dashboard analytics

- [ ] **Phase 8: Newsletter** (Day 18)
  - Subscribe endpoint
  - Unsubscribe endpoint

- [ ] **Phase 9: Testing & Deployment** (Days 19-21)
  - Unit tests
  - Integration tests
  - Production deployment

## Database Management

### Prisma Commands

```bash
# Generate Prisma Client (after schema changes)
npm run db:generate

# Create and apply migration
npm run db:migrate

# Apply migrations in production
npm run db:migrate:prod

# Seed database with initial data
npm run db:seed

# Open Prisma Studio (database GUI)
npm run db:studio

# Reset database (drop all data and re-migrate)
npm run db:reset
```

### Database Schema

The database includes 14 tables:
- **users** - User accounts with authentication
- **profiles** - User profile information
- **addresses** - Shipping/billing addresses
- **products** - Product catalog (string IDs: '1', 'acc-1')
- **product_translations** - Multi-language content (7 languages)
- **carts** - Shopping cart sessions
- **cart_items** - Cart line items (denormalized)
- **orders** - Order records (ID format: 'ORD-001')
- **order_items** - Order line items
- **subscriptions** - Audio subscription plans
- **audio_content** - Audio track metadata
- **audio_access_keys** - Download keys with expiration
- **invoices** - Invoice records (ID format: 'INV-2024-0001')
- **newsletter_subscribers** - Newsletter list

See [prisma/schema.prisma](prisma/schema.prisma) for full schema definition.

## Testing

### Test Database Connection

```bash
node test-db.js
```

This will verify:
- PostgreSQL connection
- Table counts
- Sample queries with relations

### Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-03-15T10:30:00.000Z",
  "database": "connected",
  "uptime": 123.456,
  "environment": "development"
}
```

## Documentation

- [Backend Development Prompt](../docs/backend-development-prompt.md) - Complete 21-day guide
- [Backend API Specification](../docs/backend-api-specification.md) - API reference
- [Backend Roadmap](../docs/backend-roadmap.md) - Development roadmap
- [Database Setup Guide](DATABASE-SETUP.md) - PostgreSQL setup instructions
- [Phase 0 Complete](PHASE0-COMPLETE.md) - Phase 0 achievements
- [Phase 1 Status](PHASE1-STATUS.md) - Phase 1 progress

## License

ISC
