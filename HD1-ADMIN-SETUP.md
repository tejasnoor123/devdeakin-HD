# HD1 Admin Dashboard – setup

This is an extension of the D2 DEV@Deakin application. Existing visual styling and pages are retained.

## 1. Configure the backend

In the backend hosting environment (or `backend/.env` for local development), configure:

```env
PORT=3000
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
ADMIN_EMAIL=your-existing-dev-deakin-account@example.com
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
```

Set `ADMIN_EMAIL` to the email address of the existing account you want to administer with. Do not put this value in frontend environment variables. The backend checks this allowlist and verifies the account against Firestore before allowing admin actions. Log out and log back in after setting it so a fresh JWT includes the admin role.

For local development, create `backend/.env` from `backend/.env.example`. Never commit `.env` files or real credentials.

## 2. Start the app

Terminal 1 (project root):

```bash
npm install
npm run dev
```

Terminal 2:

```bash
cd backend
npm install
node server.js
```

Open `/admin` after logging in with the allowlisted account.

## 3. Firestore assumptions

The admin API reads the existing `users` collection and a `posts` collection. User documents are expected to use the existing fields `name`, `email`, `plan`, and `createdAt`. The admin API never returns password hashes. It writes `status: "suspended"` or `status: "active"` when changing account status. New registrations should continue to default to the normal user role; do not expose role assignment in signup.

The D2 source archive supplied for this implementation did not include a working Express `/api/posts` route, although the frontend calls that endpoint. The admin moderation screen therefore expects posts to exist in Firestore under `posts`. Before demonstrating moderation, confirm the actual post storage collection and document IDs match this assumption. Do not claim moderation is verified until a real post has been removed successfully.

## 4. Security notes

- Admin authorization is checked on the backend for every dashboard API call.
- The browser's `user.role` only controls whether the navigation link is shown; it is not trusted for authorization.
- Configure a strong unique `JWT_SECRET` in Render and rotate any credentials that were ever committed or shared.
- Review Firestore security rules so ordinary clients cannot change their own `role` or `status` fields.
