# API Endpoints

Base URL: `http://localhost:4000` (or `PORT` env).

## Auth (no JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register (body: `email`, `password`, `name?`) |
| POST | `/api/auth/login` | Login (body: `email`, `password`) → `{ accessToken, user }` |

## Protected (Header: `Authorization: Bearer <token>`)

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Current user |

### Accounts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts` | List (query: `type?`) |
| GET | `/api/accounts/:id` | One account |
| POST | `/api/accounts` | Create (body: `name`, `type`, `provider?`, `balance?`, `currency?`) |
| PUT | `/api/accounts/:id` | Update (body: `name?`, `balance?`, `isActive?`) |
| DELETE | `/api/accounts/:id` | Soft delete |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List (query: `incomeOnly?`) |
| GET | `/api/categories/:id` | One category |
| POST | `/api/categories` | Create (body: `name`, `slug?`, `icon?`, `color?`, `isIncome?`) |
| PUT | `/api/categories/:id` | Update |
| DELETE | `/api/categories/:id` | Delete (non-default only) |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List (query: `from`, `to`, `accountId`, `categoryId`, `page`, `limit`) |
| GET | `/api/transactions/:id` | One transaction |
| POST | `/api/transactions` | Create (body: `accountId`, `categoryId?`, `date`, `description`, `amount`, `currency?`) |
| PUT | `/api/transactions/:id` | Update |
| PATCH | `/api/transactions/:id/category` | Reassign category (body: `categoryId` or `null`) – learns rule |
| DELETE | `/api/transactions/:id` | Delete |

### Documents (upload + OCR + AI)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/upload` | Upload (form: `file`, `accountId`) → async processing |
| GET | `/api/documents` | List documents |
| GET | `/api/documents/:id` | One document + extracted transactions |

### Rules (auto-categorization)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rules` | List rules |
| POST | `/api/rules` | Create (body: `categoryId`, `pattern`, `patternType?`, `priority?`) |
| DELETE | `/api/rules/:id` | Delete |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary` | Total balance, income, expenses, by category (query: `from`, `to`) |
| GET | `/api/dashboard/trends` | Time series (query: `from`, `to`, `groupBy=month|year`) |
