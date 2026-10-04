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

## 📁 Step 4: Place the Key in Your Project

Choose **Option A** (Simplest) or **Option B**:

### Option A: Replace the JSON file (Recommended)
1. Open your project folder:
   ```
   c:\Users\Vaibhav\Downloads\projects\school-bite
   ```
2. Take the downloaded `.json` file, rename it to:
   ```
   firebase-service-account.json
   ```
3. Replace the existing placeholder [firebase-service-account.json](file:///c:/Users/Vaibhav/Downloads/projects/school-bite/firebase-service-account.json) file with your newly downloaded file.

---

### Option B: Use `.env` Variables
Alternatively, you can open your downloaded `.json` file and copy the values into [`.env`](file:///c:/Users/Vaibhav/Downloads/projects/school-bite/.env):
```env
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## 🚀 Step 5: Verify & Seed the Database

Once your key is placed:

1. **Verify the connection**:
   ```bash
   npm run db:verify-firestore
   ```
   *You should see a green checkmark indicating successful connection to Firestore.*

2. **Populate the database with initial data (Users, Meals, Menus, Students)**:
   ```bash
   npm run db:seed-firestore
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Visit [http://localhost:3000](http://localhost:3000).

---

## 🔐 Default Demo Accounts

Once seeded, you can log in immediately with:

| Account | Email | Password | Role / Access |
| :--- | :--- | :--- | :--- |
| **Parent** | `parent@example.com` | `Parent123` | 2 children pre-linked, ₹500 wallet balance |
| **Admin** | `admin@school.com` | `Admin123` | Full canteen admin & kitchen display system |

*(Quick-fill buttons are also available directly on the login screen).*

---

## 📁 Project Firebase File Architecture

- [lib/firebase-admin.ts](file:///c:/Users/Vaibhav/Downloads/projects/school-bite/lib/firebase-admin.ts): Singleton Firebase Admin SDK initialization & credentials loader.
- [lib/firestore-db.ts](file:///c:/Users/Vaibhav/Downloads/projects/school-bite/lib/firestore-db.ts): Complete Firestore database adapter providing query, mutation, and relational operations.
- [lib/prisma.ts](file:///c:/Users/Vaibhav/Downloads/projects/school-bite/lib/prisma.ts): Re-exports the Firestore adapter so that all existing API routes communicate directly with Firestore.
- [scripts/seed-firestore.ts](file:///c:/Users/Vaibhav/Downloads/projects/school-bite/scripts/seed-firestore.ts): Migration seed script to populate Firestore with sample Indian school meals, menus, and users.
- [scripts/verify-firebase.ts](file:///c:/Users/Vaibhav/Downloads/projects/school-bite/scripts/verify-firebase.ts): Diagnostics script to test your Firestore connection.
- [firestore.rules](file:///c:/Users/Vaibhav/Downloads/projects/school-bite/firestore.rules): Security rules configuration.
- [firebase.json](file:///c:/Users/Vaibhav/Downloads/projects/school-bite/firebase.json): Firebase project CLI configuration.
