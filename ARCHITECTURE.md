# Our Money – Architecture

## Overview

Personal finance web app for a two-user household. Monorepo: **Next.js** (frontend) + **NestJS** (backend) + **PostgreSQL**.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                          │
│  Dashboard │ Transactions │ Upload │ Income │ Insurance │ Settings│
└─────────────────────────────┬───────────────────────────────────┘
                              │ REST API (JWT)
┌─────────────────────────────▼───────────────────────────────────┐
│                        NestJS Backend                            │
│  Auth │ Users │ Accounts │ Transactions │ Categories │ Documents │
│  OCR │ AI Categorization │ Connectors (pluggable)                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  PostgreSQL  │  File Storage (S3/local)  │  OpenAI  │  OCR API   │
└─────────────────────────────────────────────────────────────────┘
```

## Folder Structure

```
Our Money/
├── backend/                 # NestJS API
│   ├── src/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── accounts/
│   │   ├── transactions/
│   │   ├── categories/
│   │   ├── documents/
│   │   ├── rules/
│   │   ├── ocr/
│   │   ├── ai/
│   │   ├── connectors/      # Pluggable bank/insurance/investment APIs
│   │   └── common/
│   ├── prisma/
│   └── uploads/
├── frontend/                # Next.js App Router
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── hooks/
│   └── public/
├── ARCHITECTURE.md
├── README.md
└── .env.example
```

## Data Flow

- **Upload**: File → Storage → OCR → AI extraction → Transactions + Categories
- **Manual**: User input → Validation → Transactions
- **Connectors**: OAuth/API → Sync job → Transactions
- **Dashboard**: Aggregations from Transactions + Accounts (filtered by user/household)

## Security

- JWT for API auth; optional OAuth for “login with bank”
- All PII and financial data encrypted at rest (DB + env keys)
- Per-household isolation: queries always scoped by `householdId`
- File uploads: virus scan, type/size limits, signed URLs for cloud storage
- Environment variables for secrets; no credentials in repo

## API Conventions

- REST; JSON
- Version prefix optional: `/api/v1/...`
- Auth: `Authorization: Bearer <token>`
- Pagination: `?page=1&limit=20`
- Date filters: `?from=YYYY-MM-DD&to=YYYY-MM-DD`

## Connectors (Pluggable)

- Each provider (bank, card, insurance, pension) = one connector module
- Interface: `connect()`, `syncTransactions()`, `getBalance()`
- Credentials stored encrypted per account; sync via cron or on-demand
