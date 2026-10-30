# Profile page and email verification - design

Date: 2026-10-30

## Goal

Signed-in users can manage their account from a Profile page reached from the
navbar:

- edit their display name
- change their email (confirmed by a link sent to the new address)
- change their password, or set one if they signed up with Google

Email addresses are verified: a verification email is sent at sign-up, and
unverified users see a banner with a resend button. Unverified users can still
sign in and use the app.

## Non-goals

- Avatar / image upload.
- Blocking sign-in for unverified users (`requireEmailVerification` stays off).
- Forgot-password / reset-password flow.
- Localized email templates (emails are English only; the server does not know
  the UI language).
- Account deletion.

## Context

- API: Hono + Prisma + better-auth `1.7.14` (`apps/api/src/auth.ts`), auth
  mounted at `/auth/*` for GET and POST.
- Web: Vite + React 18 SPA, react-router-dom 6, custom i18n (`en`, `id`) in
  `apps/web/src/lib/i18n.tsx`, plain CSS in `apps/web/src/styles.css`.
- Errors are shown inline with `error-text`; there is no toast system.
- Tests: `bun test`; `typecheck` via `tsc --noEmit` in both apps.

## Design

### 1. Email sending (API)

New module `apps/api/src/email.ts`:

- `sendEmail({ to, subject, text, html }): Promise<void>` using nodemailer.
- Transport is built lazily from env. If `SMTP_HOST` is empty, the email is not
  sent; instead the subject, recipient and text body (which contains the link)
  are logged with an `[email]` prefix. This is the local dev mode.
- Send failures are caught and logged, never thrown into the auth request.
- Small template helpers build the verification and change-email messages
  (plain text + simple HTML, English).

New env vars (added to `.env.example` and `README.md` in the same change):

| Variable | Meaning |
| --- | --- |
| `SMTP_HOST` | SMTP host. Empty = log emails to the API console instead of sending. |
| `SMTP_PORT` | SMTP port, e.g. `587` (STARTTLS) or `465` (TLS). Default `587`. |
| `SMTP_SECURE` | `true` for implicit TLS (port 465), `false` otherwise. Default `false`. |
| `SMTP_USER` | SMTP username. Optional if the server needs no auth. |
| `SMTP_PASS` | SMTP password. |
| `EMAIL_FROM` | Sender address, e.g. `Clicky Habits <no-reply@clickyhabits.com>`. |

No `WEB_URL` is needed: the web client passes an absolute `callbackURL`
(`window.location.origin + path`), which is already in `trustedOrigins`.

### 2. better-auth config (`apps/api/src/auth.ts`)

```ts
emailAndPassword: { enabled: true, requireEmailVerification: false },
emailVerification: {
  sendOnSignUp: true,
  autoSignInAfterVerification: true,
  sendVerificationEmail: async ({ user, url }) => {
    void sendEmail(verificationEmail(user.email, url));
  },
},
user: {
  changeEmail: { enabled: true },
},
```

- Email sending is not awaited (timing-attack guidance from better-auth docs).
- Change email: for a verified user, better-auth sends a confirmation link to
  the new address and switches the email only after it is clicked. For an
  unverified user, better-auth updates the email immediately and sends a
  verification email to the new address. This is library behaviour and is
  accepted.
- Google users have `emailVerified = true` from the provider.
- Existing email/password users stay `emailVerified = false` and will see the
  banner; no data migration.
- `/auth/*` route: verify that every endpoint used (`/update-user`,
  `/change-email`, `/change-password`, `/send-verification-email`,
  `/verify-email`) is GET or POST in 1.7.14. If not, add the missing method.

### 3. Account endpoints (API)

Both behind the existing session middleware (extend it to `/me/*`):

- `GET /me/account` returns `{ hasPassword: boolean }`: whether the user has an
  `Account` row with `providerId = "credential"` and a non-null password.
- `POST /me/password` with `{ newPassword }`: only for users without a
  password. Validates length (8 to 128), then calls
  `auth.api.setPassword({ body: { newPassword }, headers })`. Returns 400 if
  the user already has a password (they must use change-password) or the
  password is invalid.

Users who already have a password change it from the client with
`authClient.changePassword({ currentPassword, newPassword,
revokeOtherSessions: true })`.

Validation helper `validatePassword(pw): string | null` lives in a pure module
shared logic-wise between API (`apps/api/src/password.ts`) and web (same rule
duplicated in `apps/web/src/lib/password.ts`; the apps share no package).

### 4. Web

**Route** `/profile` in `App.tsx` (signed-in only), page
`apps/web/src/pages/ProfilePage.tsx`, rendering `<Navbar />` and three cards:

1. **Profile** - name input, Save calls `authClient.updateUser({ name })`.
2. **Email** - current email with a Verified / Not verified badge. Form with a
   new email field; Submit calls
   `authClient.changeEmail({ newEmail, callbackURL: origin + "/profile?emailChanged=1" })`
   and shows "Check your new inbox to confirm the change" (or, for unverified
   users, "Email updated, check your inbox to verify it").
3. **Password** - loads `GET /me/account`.
   - `hasPassword`: current password, new password, confirm. Calls
     `changePassword`.
   - otherwise: new password, confirm, with a note that the account uses
     Google sign-in and setting a password enables email sign-in too. Calls
     `POST /me/password`.

Each card has its own busy / error / success state. Success is inline text plus
`playPop()`. Session is refetched after name or email changes.

**Navbar**: the user name span becomes a `NavLink` to `/profile` (with the
active style). The navbar also renders `VerifyEmailBanner` below the top bar.

**VerifyEmailBanner** (`apps/web/src/components/VerifyEmailBanner.tsx`): shown
when `session.user.emailVerified === false`. Text "Please verify your email"
and a Resend button calling
`authClient.sendVerificationEmail({ email, callbackURL: origin + "/app?verified=1" })`,
then "Sent" state (button disabled for 60 s to avoid spam).

**Query notices**: `?verified=1` on `/app` and `?emailChanged=1` on `/profile`
show a one-time success notice, then the param is removed from the URL.

**Sign-up**: `signUp.email` passes `callbackURL: origin + "/app?verified=1"`.
The user is signed in as today; the banner tells them to check their inbox.

**i18n**: new keys under `profile.*` and `verify.*` in both `en` and `id`, no em
or en dashes.

**Styles**: reuse existing classes; add only what is needed for cards, the
badge and the banner in `styles.css`, mobile friendly.

### 5. Error handling

- better-auth client calls return `{ error }`; show `error.message` or a
  translated fallback.
- Wrong current password, email already in use, invalid email: messages from
  better-auth shown inline.
- SMTP failures are logged server side; the UI still reports "sent" (no
  leaking of delivery state, consistent with not awaiting).

## Testing

- `apps/api/src/email.test.ts`: console fallback when `SMTP_HOST` is empty;
  transport `sendMail` called with expected fields when set (injected fake
  transport); errors swallowed.
- `apps/api/src/password.test.ts` and `apps/web/src/lib/password.test.ts`:
  length rules.
- `bun run typecheck` in both apps.
- Manual: register, click logged link, banner disappears; resend; change name;
  change email (verified and unverified); change password; Google user sets a
  password then signs in with email + password.
