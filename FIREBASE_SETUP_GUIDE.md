# 🔥 Complete Firebase Firestore Setup Guide

This project is fully equipped to use **Google Cloud Firestore** as its database. Follow these steps to set up your Firebase project and get everything running in under 5 minutes.

---

## 📋 Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **"Add project"** (or **"Create a project"**).
3. Enter a project name (e.g. `school-bite`).
4. (Optional) Disable or Enable Google Analytics according to your preference, then click **Create project**.

---

## 🗄️ Step 2: Enable Cloud Firestore Database

1. In your Firebase Console dashboard, look at the left sidebar menu under **Build**.
2. Click **Firestore Database**.
3. Click the **"Create database"** button.
4. **Database ID & Location**:
   - Leave Database ID as `(default)`.
   - Choose a location close to your users (e.g., `asia-south1 (Mumbai)` or `us-central1`).
5. **Security Rules**:
   - Select either **"Start in production mode"** or **"Start in test mode"**.
   - *(Note: Your Next.js backend uses the secure Firebase Admin SDK which has direct administrative access, so client rules will not block your server operations).*
6. Click **Create** and wait a few seconds for the database to be provisioned.

---

## 🔑 Step 3: Download your Firebase Service Account Key

1. In the top-left sidebar of the Firebase Console, click the **Gear Icon ⚙️** next to *Project Overview*, then select **Project settings**.
2. Switch to the **"Service accounts"** tab at the top.
3. Under the *Firebase Admin SDK* section, make sure **Node.js** is selected.
4. Click the blue **"Generate new private key"** button.
5. In the confirmation dialog, click **Generate key**.
6. A `.json` file will automatically download to your computer.

---

## 📁 Step 4: Configure Credentials via Environment Variables

Credentials are read **only** from environment variables. Do not place the downloaded
`.json` file inside the project folder and never commit it. Copy its values into your
local `.env` (git-ignored) and into your hosting provider's environment settings:

```env
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

`FIREBASE_PRIVATE_KEY` may contain real line breaks or literal `\n` sequences; both work.

Alternatively, set `FIREBASE_SERVICE_ACCOUNT_KEY` to the full JSON contents (raw or base64-encoded).

After copying the values, store the downloaded `.json` file outside the project or delete it.

Scripts run with `tsx` do not load `.env` automatically. Pass it explicitly, e.g.
`npx tsx --env-file=.env scripts/verify-firebase.ts`.

---

## 🚀 Step 5: Verify the Connection

Once your key is placed:

1. **Verify the connection**:
   ```bash
   npx tsx --env-file=.env.local scripts/verify-firebase.ts
   ```
   *You should see a green checkmark indicating successful connection to Firestore.*

2. **Start the development server**:
   ```bash
   npm run dev
   ```
   Visit [http://localhost:3000](http://localhost:3000).

Admin and staff accounts come from `ADMIN_EMAIL`/`ADMIN_PASS` and `STAFF_EMAIL`/`STAFF_PASS`; parents register in the app. There are no demo accounts.

---

## ⏳ Login Attempt Expiry (Firestore TTL)

Failed-login counters are stored in two collections (`lib/login-throttle.ts`). Each record has an `expiresAt` timestamp. Turn on a TTL policy in **every** Firebase project (Preview and Production) so expired records are deleted automatically:

| Collection group | TTL field |
|---|---|
| `login_attempts` | `expiresAt` |
| `login_account_activity` | `expiresAt` |

Firebase Console → **Firestore Database** → **TTL** → **Create policy**, or with the gcloud CLI:

```bash
gcloud firestore fields ttls update expiresAt --collection-group=login_attempts --enable-ttl --project=<PROJECT_ID>
gcloud firestore fields ttls update expiresAt --collection-group=login_account_activity --enable-ttl --project=<PROJECT_ID>
```

TTL deletion usually happens within 24 hours of expiry; the login code ignores expired counters on its own, so this only keeps the collections small. Without the policy, login still works correctly.

Records created by older code in `login_attempts` (keyed by email only, without `expiresAt`) are no longer read and are not removed by TTL; they are harmless and can be deleted manually.

---

## 📁 Project Firebase File Architecture

- [lib/firebase-admin.ts](lib/firebase-admin.ts): Singleton Firebase Admin SDK initialization & credentials loader.
- [lib/firestore-db.ts](lib/firestore-db.ts): Complete Firestore database adapter providing query, mutation, and relational operations.
- [lib/prisma.ts](lib/prisma.ts): Re-exports the Firestore adapter so that all existing API routes communicate directly with Firestore.
- [scripts/verify-firebase.ts](scripts/verify-firebase.ts): Diagnostics script to test your Firestore connection.
- [firestore.rules](firestore.rules): Security rules configuration.
- [firebase.json](firebase.json): Firebase project CLI configuration.
