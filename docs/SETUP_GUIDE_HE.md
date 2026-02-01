# מדריך התקנה מפורט – Our Money (לחי)

מדריך צעד-אחר-צעד להרצת האפליקציה על המחשב. כל צעד מוסבר בדיוק.

---

## דרישות מקדימות

לפני שמתחילים, צריך שיהיו מותקנים:

1. **Node.js** (גרסה 18 ומעלה)  
   - אם אין: היכנס ל־https://nodejs.org והורד את הגרסה LTS.  
   - אחרי ההתקנה פתח טרמינל (PowerShell או CMD) והקלד:  
     `node -v`  
   - אם מופיעה גרסה (למשל 20.x.x) – מצוין.

2. **PostgreSQL** (גרסה 14 ומעלה)  
   - אם אין: הורד מ־https://www.postgresql.org/download/  
   - בהתקנה בחר סיסמה ל־postgres (תזכור אותה).  
   - אפשר להשאיר פורט 5432.

3. **npm**  
   - מגיע עם Node.js. בדיקה:  
     `npm -v`  
   - אם מופיעה גרסה – מוכן.

---

## חלק א': הכנת מסד הנתונים (PostgreSQL)

### שלב 1: פתיחת PostgreSQL

- **Windows**: חפש "pgAdmin" או "SQL Shell" בתפריט התחל, או פתח טרמינל והרץ:
  ```bash
  psql -U postgres
  ```
  (יתבקש להזין את סיסמת ה־postgres שהגדרת בהתקנה)

- **אם יש לך pgAdmin**: פתח pgAdmin, התחבר ל־PostgreSQL, ולחץ ימני על "Databases" → Create → Database.

### שלב 2: יצירת מסד נתונים חדש

בטרמינל (אחרי שהתחברת ל־postgres):

```sql
CREATE DATABASE our_money;
```

או ב־pgAdmin: ימני על Databases → Create → Database, שם: `our_money` → Save.

### שלב 3: כתיבת כתובת החיבור (Connection String)

הכתובת נראית כך:

```
postgresql://USERNAME:PASSWORD@localhost:5432/our_money
```

- **USERNAME** – בדרך כלל `postgres` (או שם המשתמש שיצרת).
- **PASSWORD** – הסיסמה של המשתמש ב־PostgreSQL.
- **localhost** – אם PostgreSQL רץ על אותו מחשב.
- **5432** – הפורט (ברירת המחדל).
- **our_money** – שם מסד הנתונים שיצרת.

**דוגמה:**
```
postgresql://postgres:MyPassword123@localhost:5432/our_money
```

שמור את השורה הזו – תשתמש בה בשלב הבא.

---

## חלק ב': הרצת הבקאנד (API)

### שלב 1: מעבר לתיקיית הבקאנד

פתח טרמינל (PowerShell או CMD) והגע לתיקיית הפרויקט. אם הפרויקט נמצא ב־Desktop תחת "Our Money":

```bash
cd "C:\Users\Yoav\Desktop\Our Money\backend"
```

(החלף את Yoav בשם המשתמש שלך אם שונה.)

### שלב 2: יצירת קובץ .env

1. בתיקייה `backend` חפש קובץ בשם `.env.example`.
2. העתק אותו ושנה את השם ל־`.env` (בלי .example).
3. פתח את `.env` בעורך טקסט (Notepad, VS Code וכו').

### שלב 3: מילוי הערכים ב־.env

ערוך את השורות הבאות (השאר את השאר כרגע):

**חובה:**

- **DATABASE_URL**  
  הדבק את כתובת החיבור שיצרת בחלק א':
  ```
  DATABASE_URL="postgresql://postgres:MyPassword123@localhost:5432/our_money"
  ```
  (החלף את הסיסמה והשם אם שונה.)

- **JWT_SECRET**  
  מחרוזת ארוכה ואקראית (לפחות 32 תווים). לדוגמה:
  ```
  JWT_SECRET="our-money-secret-key-2024-change-in-production-xyz"
  ```

**אופציונלי (אפשר להשאיר ריק או למלא אחר כך):**

- **FRONTEND_URL**  
  כתובת האתר של הפרונט (בפיתוח):
  ```
  FRONTEND_URL="http://localhost:3000"
  ```

- **OPENAI_API_KEY**  
  רק אם יש לך מפתח מ־OpenAI (לחילוץ אוטומטי מטענות):
  ```
  OPENAI_API_KEY="sk-..."
  ```

שמור את הקובץ `.env`.

### שלב 4: התקנת חבילות (packages)

בטרמינל, כשאתה עדיין בתיקייה `backend`:

```bash
npm install
```

חכה עד שההתקנה מסתיימת (ללא שגיאות אדומות).

### שלב 5: יצירת הטבלאות במסד הנתונים (Prisma)

הרץ את הפקודות הבאות **באותו טרמינל**, אחת אחרי השנייה:

```bash
npx prisma generate
```

ואז:

```bash
npx prisma migrate dev --name init
```

- בפעם הראשונה ייווצרו כל הטבלאות (Users, Households, Accounts, Transactions וכו').
- אם תופיע שאלה על יצירת migration – אשר (Y).

### שלב 6: הפעלת שרת הבקאנד

```bash
npm run start:dev
```

- אם הכל תקין תראה הודעה כמו:  
  `API running at http://localhost:4000`
- השאר את החלון פתוח – השרת רץ ברקע.
- אם יש שגיאה – בדוק ש־PostgreSQL פועל וש־DATABASE_URL ב־.env נכון (כולל סיסמה).

**אם כבר רצת מיגרציות בעבר ויש תנועות תשלומים שמציגות סכום מלא במקום תשלום בודד:** הרץ:
```bash
npx prisma migrate deploy
```
(זה מפעיל מיגרציה שמתקנת במסד את הסכומים של תשלומים.)

---

## חלק ג': הרצת הפרונט (האתר)

### שלב 1: פתיחת טרמינל שני

- השאר את טרמינל הבקאנד פתוח.
- פתח טרמינל **חדש** (PowerShell או CMD).

### שלב 2: מעבר לתיקיית הפרונט

```bash
cd "C:\Users\Yoav\Desktop\Our Money\frontend"
```

(החלף את Yoav בשם המשתמש שלך אם שונה.)

### שלב 3: התקנת חבילות

```bash
npm install
```

חכה עד שההתקנה מסתיימת.

### שלב 4: (אופציונלי) קובץ .env לפרונט

אם הבקאנד רץ על פורט אחר מ־4000, צור בתיקיית `frontend` קובץ בשם `.env.local` עם השורה:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

אם הבקאנד על 4000 – אפשר בלי הקובץ (הברירת מחדל היא 4000).

### שלב 5: הפעלת הפרונט

```bash
npm run dev
```

- כשמוכן תראה משהו כמו:  
  `Ready on http://localhost:3000`
- פתח דפדפן וגלוש לכתובת:  
  **http://localhost:3000**

---

## חלק ד': שימוש ראשון באפליקציה

### שלב 1: הרשמה

1. בדפדפן ב־http://localhost:3000 תועבר ל־"Sign in".
2. לחץ על **"Register"** (למטה).
3. מלא:
   - **Name** – השם שלך (אופציונלי).
   - **Email** – אימייל (חובה).
   - **Password** – סיסמה (לפחות 8 תווים).
4. לחץ **"Create account"**.
5. אחרי ההרשמה תועבר אוטומטית ל־Dashboard.

### שלב 2: הוספת חשבון (Account)

1. בתפריט הצד לחץ **"Settings"**.
2. בחלק "Accounts" מלא:
   - **Name** – למשל "בנק לאומי" או "כרטיס אשראי".
   - **Type** – בחר Bank / Credit Card / Cash וכו'.
   - **Balance** – יתרה נוכחית (אם רלוונטי).
3. לחץ **"Add"**.
4. החשבון יופיע ברשימה.

### שלב 3: צפייה ב־Dashboard

1. לחץ **"Dashboard"** בתפריט.
2. בחר טווח תאריכים (From – To).
3. תראה:
   - **Total balance** – סכום כולל מכל החשבונות.
   - **Income / Expenses** – לפי הטווח שבחרת.
   - **Spending by category** – גרף עוגה לפי קטגוריות.
   - **Trends** – גרף עמודות לאורך זמן.

### שלב 4: הוספת תנועה ידנית (אופציונלי)

1. **Transactions** – רשימת תנועות (אחרי שיהיו תנועות).
2. **Income** – הוספת הכנסה: בחר חשבון, קטגוריה, תאריך, תיאור וסכום → Save.
3. **Upload Documents** – העלאת צילום מסך/סריקה של חשבון או קבלה; המערכת תנסה לחלץ תנועות (OCR + AI אם הוגדר OPENAI_API_KEY).

### שלב 5: התחברות מחדש (Login)

בפעם הבאה שתפתח את האתר:

1. גלוש ל־http://localhost:3000.
2. אם תועבר ל־"Sign in" – הזן **Email** ו־**Password** ולחץ **"Sign in"**.

---

## סיכום פקודות – למי שמכיר

| שלב | איפה | פקודה |
|-----|------|--------|
| מסד נתונים | PostgreSQL | `CREATE DATABASE our_money;` |
| .env | backend | למלא DATABASE_URL, JWT_SECRET |
| התקנה | backend | `npm install` |
| טבלאות | backend | `npx prisma generate` ואז `npx prisma migrate dev --name init` |
| הפעלת API | backend | `npm run start:dev` |
| התקנה | frontend | `cd frontend` ואז `npm install` |
| הפעלת אתר | frontend | `npm run dev` |
| גלישה | דפדפן | http://localhost:3000 |

---

## פתרון בעיות נפוצות

**"Cannot find module" / שגיאות בהרצה**  
- וודא שהרצת `npm install` בתיקייה הנכונה (backend או frontend).

**"Connection refused" / שגיאת חיבור ל־DB**  
- וודא ש־PostgreSQL רץ (שירות פעיל או חלון psql/pgAdmin פתוח).  
- בדוק ש־DATABASE_URL ב־.env תואם: משתמש, סיסמה, localhost, 5432, our_money.

**האתר לא נטען / "Failed to fetch"**  
- וודא שהבקאנד רץ (`npm run start:dev` ב־backend) ומופיע שרץ על http://localhost:4000.  
- אם הבקאנד על פורט אחר, הוסף ב־frontend בקובץ `.env.local`:  
  `NEXT_PUBLIC_API_URL=http://localhost:PORT`

**שגיאה בעברית / קידוד**  
- הקבצים בפרויקט ב־UTF-8. אם יש בעיית תצוגה, וודא שהדפדפן והעורך על UTF-8.

אם חי נתקל בשגיאה ספציפית – אפשר להעתיק את הודעת השגיאה ולשלוח, ואז אפשר לדייק לפי זה.
