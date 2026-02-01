# Our Money – Household Finance App

Personal finance web app for a two-user household: dashboard, transactions, upload + OCR + AI extraction, income, insurance & funds, and settings.

## Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Recharts
- **Backend**: NestJS, Prisma, PostgreSQL
- **Auth**: JWT
- **OCR**: Tesseract.js (default); extensible for Google Vision / AWS Textract
- **AI**: OpenAI for transaction extraction and categorization

## Project structure

```
Our Money/
├── backend/          # NestJS API
│   ├── prisma/       # Schema & migrations
│   └── src/           # Auth, Users, Accounts, Transactions, Categories, Documents, Rules, Dashboard
├── frontend/          # Next.js app
│   └── src/app/       # Login, (main)/dashboard, transactions, upload, income, insurance-funds, settings
├── docs/              # API.md, OCR_CATEGORIZATION.md
├── ARCHITECTURE.md
└── .env.example
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- (Optional) OpenAI API key for AI extraction
- (Optional) Google Vision / AWS credentials for cloud OCR

## Setup

### 1. Clone and install

```bash
cd "Our Money"
```

### 2. Backend

```bash
cd backend
cp ../.env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, optionally OPENAI_API_KEY
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

API runs at **http://localhost:4000**.

### 3. Frontend

```bash
cd frontend
npm install
# Optional: create .env.local with NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev
```

App runs at **http://localhost:3000**.

### 4. First use

1. Open http://localhost:3000
2. Click **Register** and create an account (email + password)
3. Go to **Settings** and add at least one account (e.g. Bank, type: Bank)
4. Use **Dashboard** for summary; **Transactions** to filter; **Upload Documents** to upload a statement image (OCR + AI will extract transactions)
5. Use **Income** to add salary/recurring income; **Insurance & Funds** to see insurance/pension/investment accounts

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT (min 32 chars) |
| `JWT_EXPIRES_IN` | e.g. `7d` |
| `FRONTEND_URL` | CORS origin (e.g. http://localhost:3000) |
| `OPENAI_API_KEY` | For AI extraction and categorization |
| `OCR_PROVIDER` | `tesseract` (default), or `google` / `aws` when implemented |

See `.env.example` for more.

## API

See [docs/API.md](docs/API.md) for endpoints. Auth: `POST /api/auth/register`, `POST /api/auth/login`; then use `Authorization: Bearer <token>` for protected routes.

## OCR + AI pipeline

See [docs/OCR_CATEGORIZATION.md](docs/OCR_CATEGORIZATION.md) for the upload → OCR → AI extraction → transactions flow and example code.

## Security

- JWT for API auth; store token in localStorage (consider httpOnly cookie for production)
- All data scoped by household
- Use strong `JWT_SECRET` and HTTPS in production
- Do not commit `.env`; use env vars for secrets

## License

Private use; modify as needed.
