# Digital Loyalty System for Pizza Restaurant

## Overview

This is a full-stack digital loyalty application built for "Che Pizza da Salva" restaurant. The system manages customer loyalty points, digital coupons, QR code scanning, and customer feedback. It features role-based access control with different interfaces for customers, front desk staff, and administrators.

**Migration Status**: Successfully migrated from Express to Fastify backend with React UI completely preserved through legacy API adapter layer.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Query (TanStack Query) for server state
- **UI Library**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom brand colors
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Fastify framework (migrated from Express.js)
- **Language**: TypeScript with ES modules
- **Database ORM**: Prisma ORM with PostgreSQL (backend), Drizzle ORM (legacy frontend)
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **File Structure**: Modular separation with Fastify plugins and routes
- **Migration Layer**: Legacy API adapter provides seamless transition for React components

### Database Design
- **Primary Database**: PostgreSQL via Neon Database
- **Schema Management**: Drizzle migrations
- **Key Tables**: 
  - `users` - Customer and staff accounts with role-based access and last_seen tracking
  - `coupons` - Digital coupons with QR codes
  - `feedback` - NPS scores and customer comments
  - `stamp_transactions` - Loyalty point history
  - `email_logs` and `sms_logs` - Communication tracking

## Key Components

### Authentication System
- Multi-factor registration with email/phone verification
- Role-based access control (user, frontdesk, admin, dev)
- Session-based authentication with PostgreSQL session storage
- Password reset functionality with secure tokens

### Loyalty Point System
- Digital stamp collection (15 stamps = 1 free pizza)
- QR code generation for each user and coupon
- Staff can scan customer QR codes to add stamps
- Automatic coupon generation when stamp threshold is reached

### QR Code Integration
- Customer QR codes for loyalty point collection
- Coupon QR codes for redemption
- Browser-based QR scanner using ZXing library
- Manual QR code input fallback for staff

### Communication Services
- Email verification and notifications (Resend API ready)
- SMS verification for phone numbers (Twilio integration)
- Password reset emails with secure token links

### Multi-Role Interfaces
- **Customer App**: View loyalty card, redeem coupons, QR code display
- **Front Desk iPad**: Collect customer feedback with NPS scoring
- **Staff Scanner**: QR code scanning for stamp collection and coupon redemption
- **Admin Dashboard**: Analytics, user management, system overview
- **CRM System**: Customer relationship management and staff registration

## Data Flow

1. **Customer Registration**: Email/phone verification → Account creation → QR code generation
2. **Loyalty Collection**: Staff scans customer QR → Stamps added → Auto-coupon generation at threshold
3. **Coupon Redemption**: Staff scans coupon QR → Coupon marked as redeemed
4. **Feedback Loop**: Customers provide NPS scores → Data aggregated for analytics
5. **Admin Oversight**: Real-time analytics dashboard and customer management

## Migration Architecture

### Legacy API Adapter
- **Purpose**: Provides compatibility layer between React UI and new Fastify backend
- **Location**: `client/src/lib/legacy-api-adapter.ts`
- **Function**: Maps all existing API calls to new Fastify endpoints without UI changes
- **Coverage**: Complete authentication, user management, loyalty system, QR codes, analytics

### HTTP Infrastructure
- **HTTP Client**: `client/src/lib/http.ts` with automatic token management
- **Token Service**: `client/src/lib/token-service.ts` for JWT handling
- **Retry Logic**: `client/src/lib/retry-middleware.ts` for robust API calls
- **Error Handling**: Centralized error normalization and field-level validation

### Development Setup
- **Backend**: Fastify server on port 5000 (matches Vite proxy configuration)
- **Frontend**: React/Vite development server with API proxy routing
- **Database**: Prisma migrations and schema in backend, legacy Drizzle retained for compatibility

## Recent Changes (August 15, 2025)

✅ **Migration Infrastructure Complete:**
- Built comprehensive legacy API adapter covering all application endpoints
- Implemented robust HTTP client with authentication and retry mechanisms
- Successfully integrated Fastify backend with React frontend
- Resolved all TypeScript import issues in React components
- Configured development environment with proper port routing

✅ **Backend Integration:**
- Fastify server running successfully on port 5000
- API routing confirmed working (endpoints responding correctly)
- JWT authentication and plugin architecture preserved
- Environment configuration and database connection established

## External Dependencies

### Core Libraries
- **Database**: `@neondatabase/serverless`, `drizzle-orm`
- **Authentication**: `bcrypt`, `express-session`, `connect-pg-simple`
- **QR Codes**: `qrcode` (generation), `@zxing/library` (scanning)
- **Communication**: `resend` (email), `twilio` (SMS)
- **UI Components**: Complete Shadcn/ui component library with Radix primitives

### Development Tools
- **Build**: `vite`, `esbuild`, `tsx` for TypeScript execution
- **Validation**: `zod` with `drizzle-zod` integration
- **Forms**: `react-hook-form` with `@hookform/resolvers`

## Deployment Strategy

### Development Environment
- Replit-hosted development with hot reload
- Vite dev server proxying API requests to Express
- PostgreSQL database provisioned through Replit modules

### Production Deployment
- **Build Process**: Vite builds frontend, esbuild bundles backend
- **Runtime**: Node.js production server serving static files and API
- **Database**: PostgreSQL with Drizzle migrations
- **Environment**: Configured for Replit autoscale deployment

### Configuration Management
- Environment variables for database, API keys, and secrets
- Separate development and production configurations
- Session secrets and JWT tokens properly secured

## Changelog

```
Changelog:
- June 28, 2025: Customer last_seen tracking implementation
  * Added last_seen column to users table for customer activity tracking
  * Implemented automatic timestamp updates on stamp transactions
  * Enhanced coupon redemption to record customer interactions
  * Populated historical data from existing stamp transactions (75 users updated)
  * Added getUsersByLastSeen function for CRM analytics
  * Updated inactive users calculation to use last_seen instead of created_at
  * Preserved all existing production data during database migration
- June 27, 2025: QR scanner camera switching fully resolved
  * Fixed PostgreSQL column naming issue (stamps_added vs stamps) 
  * Implemented robust rear camera selection for mobile devices
  * Added facingMode constraints and device enumeration fallback
  * Enhanced camera switching with race condition prevention
  * Added TypeScript strict null safety compliance
  * Improved error handling and user feedback
  * Added automatic scan start on page load for faster operations
  * Simplified camera controls to rear/front toggle only
  * Intelligent rear camera prioritization (wide/main first)
  * Reduced console error spam from routine scanning operations
  * RESOLVED: Camera switching now works correctly with proper device ID management
  * RESOLVED: Labels accurately reflect actual camera in use (Posteriore/Frontale)
  * Enhanced camera verification to prevent state/hardware mismatches
- June 24, 2025: Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```