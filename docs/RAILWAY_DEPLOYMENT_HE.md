# מדריך פריסה ל-Railway – Our Money

מדריך מלא להעלאת האפליקציה (Backend + Frontend + PostgreSQL) ל-Railway.

---

## שלב 0: הכנה – Git

### 0.1 לוודא ש-Git מאותחל

```bash
cd "C:\Users\Yoav\Desktop\Our Money"
git status
```

אם מופיע שגיאה "not a git repository" – אתחל:

```bash
git init
```

### 0.2 קובץ .gitignore

ודא ש-`.gitignore` מכיל (כבר קיים):

```
node_modules
.env
.env.local
*.log
.DS_Store
dist
.next
build
uploads
*.db
```

### 0.3 יצירת Repository ב-GitHub

1. היכנס ל-[github.com](https://github.com) ולחץ **New repository**
2. שם: `our-money` (או שם אחר)
3. בחר **Private** אם אינך רוצה שהקוד יהיה פומבי
4. אל תסמן "Add README" – התיקייה כבר קיימת
5. לחץ **Create repository**

### 0.4 העלאה ל-GitHub

```bash
cd "C:\Users\Yoav\Desktop\Our Money"

# הוספת הקבצים
git add .

# קומיט ראשון
git commit -m "Initial commit - Our Money app"

# חיבור ל-GitHub (החלף USERNAME ו-REPO בשם המשתמש והמאגר שלך)
git remote add origin https://github.com/USERNAME/REPO.git

# דחיפה
git branch -M main
git push -u origin main
```

אם GitHub מבקש התחברות – השתמש ב-Token או ב-GitHub CLI.

---

## שלב 1: חשבון Railway

1. היכנס ל-[railway.app](https://railway.app)
2. לחץ **Login** והתחבר עם GitHub
3. אשר גישה ל-GitHub

---

## שלב 2: יצירת פרויקט

1. ב-Railway לחץ **New Project**
2. בחר **Deploy from GitHub repo**
3. בחר את המאגר `our-money` (או השם שבחרת)
4. בחר **Configure** – בשלב זה אין עדיין שירותים

---

## שלב 3: הוספת PostgreSQL

1. בתוך הפרויקט, לחץ **+ New**
2. בחר **Database** → **PostgreSQL**
3. Railway ייצור מסד נתונים וייתן משתנה `DATABASE_URL`
4. לחץ על שורת ה-Database, עבור ל-**Variables** וצלם/שמור את `DATABASE_URL` – תצטרך אותו

---

## שלב 4: פריסת ה-Backend (NestJS)

1. לחץ **+ New** → **GitHub Repo**
2. בחר את אותו מאגר `our-money`
3. לאחר שנוצר השירות, לחץ עליו ונכנס להגדרות

### 4.1 הגדרות Build

ב-**Settings**:

| שדה | ערך |
|-----|-----|
| **Root Directory** | `backend` |
| **Build Command** | `npm install && npx prisma generate && npm run build` |
| **Start Command** | `npx prisma migrate deploy && npm run start` |
| **Watch Paths** | `backend/**` |

### 4.2 משתני סביבה (Variables)

ב-**Variables** הוסף:

| משתנה | ערך |
|-------|-----|
| `DATABASE_URL` | העתק מ-PostgreSQL (לחץ **Add Reference** → **Postgres** → **DATABASE_URL**) |
| `JWT_SECRET` | מפתח סודי ארוך (למשל: `openssl rand -base64 32`) |
| `JWT_EXPIRES_IN` | `7d` |
| `PORT` | `4000` |
| `FRONTEND_URL` | בינתיים השאר ריק – מעדכן אחרי פריסת ה-Frontend |

### 4.3 Domain

1. עבור ל-**Settings** → **Networking**
2. לחץ **Generate Domain**
3. Railway ייתן כתובת כמו `backend-production-xxxx.up.railway.app`
4. העתק את הכתובת – זו כתובת ה-API
5. עדכן `FRONTEND_URL` כשתקבל את כתובת ה-Frontend

---

## שלב 5: פריסת ה-Frontend (Next.js)

1. לחץ **+ New** → **GitHub Repo**
2. בחר את אותו מאגר `our-money`
3. לחץ על השירות שנפתח

### 5.1 הגדרות Build

ב-**Settings**:

| שדה | ערך |
|-----|-----|
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |
| **Watch Paths** | `frontend/**` |

### 5.2 משתני סביבה

ב-**Variables**:

| משתנה | ערך |
|-------|-----|
| `NEXT_PUBLIC_API_URL` | כתובת ה-Backend (למשל `https://backend-production-xxxx.up.railway.app`) |

### 5.3 Domain

1. **Settings** → **Networking** → **Generate Domain**
2. קבל כתובת כמו `frontend-production-yyyy.up.railway.app`
3. חזור ל-Backend ועדכן `FRONTEND_URL` לכתובת הזו (כולל `https://`)

---

## שלב 6: הגדרות CORS ב-Backend

ב-Backend, `main.ts` משתמש ב-`FRONTEND_URL` ל-CORS. ודא ש-`FRONTEND_URL` מכיל את כתובת ה-Frontend המלאה.

---

## שלב 7: הרצת Migrations

אם ה-backend כבר עלה בהצלחה – ה-Prisma migrations רצות ב-`npx prisma migrate deploy` בתוך Start Command.

אם יש שגיאה – אפשר להרין ידנית:

1. ב-Backend לחץ **Settings** → **Deploy**
2. או הרץ מקומית עם `DATABASE_URL` מ-Railway:

```bash
cd backend
$env:DATABASE_URL="postgresql://..."  # העתק מ-Railway
npx prisma migrate deploy
```

---

## שלב 8: בדיקה

1. גלוש לכתובת ה-Frontend (למשל `https://frontend-production-yyyy.up.railway.app`)
2. נסה להירשם / להתחבר
3. בדוק שהאפליקציה עובדת

---

## עדכונים עתידיים

כדי לעדכן את האפליקציה אחרי שינויים בקוד:

```bash
cd "C:\Users\Yoav\Desktop\Our Money"
git add .
git commit -m "תיאור השינוי"
git push origin main
```

Railway יזהה את ה-push ויבצע deploy אוטומטי.

---

## פתרון בעיות

### Backend לא עולה
- בדוק ב-**Deployments** → **View Logs**
- ודא ש-`DATABASE_URL` תקין
- ודא ש-`JWT_SECRET` מוגדר

### P1001: Can't reach database server at our-money.railway.internal
אם ה-Backend מנסה להתחבר ל-`railway.internal` ונכשל:

1. **השינוי בקוד** – נוספה השהיה של 5 שניות בתחילת ה-Start Command. בצע `git push` כדי לפרוס מחדש.
2. **שימוש ב-DATABASE_PUBLIC_URL** – אם אחרי ה-push עדיין נכשל:
   - היכנס ל-**PostgreSQL** → **Variables** והעתק את `DATABASE_PUBLIC_URL`
   - היכנס ל-**Backend** → **Variables**
   - עדכן `DATABASE_URL` להעתקה של `DATABASE_PUBLIC_URL` (במקום Reference ל-DATABASE_URL הרגיל)
   - **Redeploy** ל-Backend
3. ודא ש-**Backend** ו-**PostgreSQL** באותו פרויקט Railway

### Frontend מציג שגיאות רשת
- ודא ש-`NEXT_PUBLIC_API_URL` מכיל את כתובת ה-Backend (כולל `https://`)
- ודא ש-`FRONTEND_URL` ב-Backend תואם את כתובת ה-Frontend (CORS)

### שגיאות Prisma
- הרץ מקומית: `cd backend && npx prisma migrate deploy` עם `DATABASE_URL` מ-Railway
- ודא שכל ה-migrations ב-`backend/prisma/migrations` בקוד

---

## משתני סביבה אופציונליים (AI, OCR)

אם תרצה להשתמש ב-AI לסיווג תנועות:

| משתנה | ערך |
|-------|-----|
| `OPENAI_API_KEY` | מפתח מ-[platform.openai.com](https://platform.openai.com) |
| `OPENAI_MODEL` | `gpt-4o` |

---

## עלויות משוערות ב-Railway

- **Hobby Plan**: $5/חודש – מספיק להתחלה
- PostgreSQL נכלל בפריסה
- העלויות עולות עם שימוש (traffic, שעות ריצה)
