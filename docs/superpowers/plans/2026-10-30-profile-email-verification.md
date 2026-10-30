# Profile Page and Email Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in users manage name, email and password from a `/profile` page reached from the navbar, and email addresses get verified via SMTP-sent links.

**Architecture:** API gains an nodemailer-based `email.ts` (console fallback when `SMTP_HOST` is empty), better-auth `emailVerification` + `user.changeEmail`, and two session-guarded routes `GET /me/account`, `POST /me/password`. Web gains `ProfilePage`, a `VerifyEmailBanner` rendered by `Navbar`, and the navbar user name becomes a link to `/profile`.

**Tech Stack:** Bun, Hono 4, Prisma 6, better-auth 1.7.14, nodemailer, Vite + React 18, react-router-dom 6, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-10-30-profile-email-verification-design.md`

## Global Constraints

- Never use em dash or en dash in any copy, comment or commit message. Use `-`.
- Every new env var goes into `.env.example` (with comment + local and production examples) and `README.md` in the same change.
- New env vars: `SMTP_HOST`, `SMTP_PORT` (default `587`), `SMTP_SECURE` (default `false`), `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`. No `WEB_URL`.
- `requireEmailVerification` stays `false`.
- Email sending is never awaited inside better-auth callbacks; send errors are logged, never thrown.
- Password rule: length 8 to 128 inclusive.
- All new UI copy exists in both `en` and `id` in `apps/web/src/lib/i18n.tsx`.
- Errors shown inline with `className="error-text"`; success inline + `playPop()`. No toast lib.
- Emails are English only.

## Review Focus

- Wrong current password on change-password: inline error, form keeps values, no crash. (Task 6 manual check)
- New email already used by another account: inline error from better-auth shown. (Task 6 manual check)
- Google user (no credential account) calls `POST /me/password` twice: second call returns 400 `already_has_password`. (Task 3 test)
- SMTP transport throws (bad host / auth): sign-up still succeeds, error logged with `[email]` prefix. (Task 1 test `swallows transport errors`)
- Confirm password mismatch: blocked client side before any request. (Task 4 test on `validateNewPassword`)

---

### Task 1: Email module + SMTP env

**Files:**
- Create: `apps/api/src/email.ts`
- Test: `apps/api/src/email.test.ts`
- Modify: `apps/api/package.json` (add `nodemailer`, devDep `@types/nodemailer`)
- Modify: `.env.example`, `README.md`

**Interfaces:**
- Produces:
  - `type EmailMessage = { to: string; subject: string; text: string; html: string }`
  - `type MailTransport = { sendMail(msg: EmailMessage & { from: string }): Promise<unknown> }`
  - `createEmailSender(env: Record<string, string | undefined>, opts?: { transport?: MailTransport; log?: (...a: unknown[]) => void }): (msg: EmailMessage) => Promise<void>`
  - `sendEmail(msg: EmailMessage): Promise<void>` (built from `process.env`, transport created lazily via `nodemailer.createTransport({ host, port, secure, auth })`, `auth` omitted when `SMTP_USER` empty)
  - `verificationEmail(to: string, url: string): EmailMessage` (subject `Verify your Clicky Habits email`)
  - `changeEmailEmail(to: string, url: string): EmailMessage` (subject `Confirm your new Clicky Habits email`)

- [ ] **Step 1: Write failing tests** in `email.test.ts`:
  - `logs instead of sending when SMTP_HOST is empty`: sender with `{}` env, fake `log`; after send, `log` called once and an arg string contains the recipient and the text body (link).
  - `sends through transport with EMAIL_FROM when SMTP_HOST is set`: env `{ SMTP_HOST: "smtp.test", EMAIL_FROM: "A <a@x.com>" }`, fake transport; `sendMail` called with `{ from: "A <a@x.com>", to, subject, text, html }`.
  - `swallows transport errors`: transport `sendMail` rejects; `await send(msg)` resolves; `log` called with first arg `"[email]"`-prefixed string.
  - `verificationEmail includes the url in text and html`.
- [ ] **Step 2:** `cd apps/api; bun test src/email.test.ts` - expect FAIL (module missing).
- [ ] **Step 3:** `bun add nodemailer; bun add -d @types/nodemailer` in `apps/api`, implement `email.ts`. Default `EMAIL_FROM` when empty: `Clicky Habits <no-reply@localhost>`.
- [ ] **Step 4:** `bun test src/email.test.ts` - expect PASS.
- [ ] **Step 5:** Add an `# Email (SMTP)` block to `.env.example` in the optional section with the six vars, each commented: empty `SMTP_HOST` = links printed to API console (local); production example `smtp.gmail.com` / `587` / `false` / user / app password / `Clicky Habits <no-reply@clickyhabits.com>`. Add matching rows/notes to `README.md` env section.
- [ ] **Step 6: Commit** `feat(api): add SMTP email sender with console fallback`

### Task 2: better-auth verification + change email

**Files:**
- Modify: `apps/api/src/auth.ts:57-75`
- Modify: `apps/api/src/index.ts:43` (only if needed)

**Interfaces:**
- Consumes: `sendEmail`, `verificationEmail`, `changeEmailEmail` from Task 1.

- [ ] **Step 1:** Add to `betterAuth({...})`:
  - `emailAndPassword: { enabled: true, requireEmailVerification: false }`
  - `emailVerification: { sendOnSignUp: true, autoSignInAfterVerification: true, sendVerificationEmail: async ({ user, url }) => { void sendEmail(verificationEmail(user.email, url)); } }`
  - `user: { changeEmail: { enabled: true, sendChangeEmailVerification: async ({ newEmail, url }) => { void sendEmail(changeEmailEmail(newEmail, url)); } } }`
  - Check `node_modules/better-auth` types for 1.7.14: if `sendChangeEmailVerification` does not exist there, drop it (the confirmation then goes through `sendVerificationEmail` to the new address) and use `changeEmailEmail` only if the callback exposes enough info to choose it.
- [ ] **Step 2:** Confirm methods of `/update-user`, `/change-email`, `/change-password`, `/send-verification-email`, `/verify-email` in better-auth source are GET or POST. If any is not, add the method to `app.on([...], "/auth/*", ...)`.
- [ ] **Step 3:** `cd apps/api; bunx tsc --noEmit; bun test` - expect PASS.
- [ ] **Step 4:** Smoke: `bun run dev` with empty `SMTP_HOST`, `POST /auth/sign-up/email` (curl) logs `[email]` with a `/auth/verify-email?token=` link; opening it sets `emailVerified=true`.
- [ ] **Step 5: Commit** `feat(auth): send verification and change-email links`

### Task 3: `/me` account routes

**Files:**
- Create: `apps/api/src/password.ts`, `apps/api/src/me-routes.ts`
- Test: `apps/api/src/password.test.ts`, `apps/api/src/me-routes.test.ts`
- Modify: `apps/api/src/index.ts` (session middleware for `/me/*`, register routes)
- Modify: `apps/web/vite.config.ts` (add `"/me"` to `API_PREFIXES`), `README.md` (path lists at lines ~38, ~84, ~106 include `/me`)

**Interfaces:**
- Produces:
  - `validatePassword(pw: unknown): "password_too_short" | "password_too_long" | null` (non-string = `password_too_short`)
  - `type MeDeps = { hasPassword(userId: string): Promise<boolean>; setPassword(newPassword: string, headers: Headers): Promise<void> }`
  - `registerMeRoutes(app: Hono<{ Variables: { userId: string } }>, deps: MeDeps): void`
  - `GET /me/account` -> `200 { hasPassword: boolean }`
  - `POST /me/password` body `{ newPassword }` -> `200 { ok: true }` | `400 { error: "password_too_short" | "password_too_long" | "already_has_password" }`
  - Prisma-backed `hasPassword`: `prisma.account.count({ where: { userId, providerId: "credential", password: { not: null } } }) > 0`; `setPassword` calls `auth.api.setPassword({ body: { newPassword }, headers })`.

- [ ] **Step 1: Write failing tests**
  - `password.test.ts`: 7 chars -> `password_too_short`; 8 -> null; 128 -> null; 129 -> `password_too_long`; `undefined` -> `password_too_short`.
  - `me-routes.test.ts` (Hono app with a test middleware setting `userId`, fake deps): `GET /me/account` returns `{ hasPassword: false }`; `POST /me/password` with `"short"` -> 400 `password_too_short`, `setPassword` not called; valid password + `hasPassword=false` -> 200, `setPassword` called once; valid + `hasPassword=true` -> 400 `already_has_password`.
- [ ] **Step 2:** `bun test src/password.test.ts src/me-routes.test.ts` - expect FAIL.
- [ ] **Step 3:** Implement both modules; in `index.ts` add `app.use("/me/*", ...)` session middleware matching the `/habits/*` one and `registerMeRoutes(app, prismaMeDeps)`.
- [ ] **Step 4:** Tests PASS; `bunx tsc --noEmit` PASS.
- [ ] **Step 5:** Update vite proxy + README path lists.
- [ ] **Step 6: Commit** `feat(api): add /me account and set-password routes`

### Task 4: Web client helpers + i18n

**Files:**
- Create: `apps/web/src/lib/password.ts`, `apps/web/src/lib/password.test.ts`
- Modify: `apps/web/src/lib/auth.ts` (export `authClient` already; also export `useSession` unchanged)
- Modify: `apps/web/src/lib/api.ts` (add `getAccount`, `setPassword`)
- Modify: `apps/web/src/lib/i18n.tsx` (`en` and `id`)

**Interfaces:**
- Produces:
  - `validateNewPassword(pw: string, confirm: string): "password_too_short" | "password_too_long" | "password_mismatch" | null` (length checks first, then mismatch)
  - `api.getAccount(): Promise<{ hasPassword: boolean }>`
  - `api.setPassword(newPassword: string): Promise<{ ok: true }>`
  - i18n keys (both languages): `nav.profile`, `profile.title`, `profile.nameSection`, `profile.name`, `profile.nameSaved`, `profile.emailSection`, `profile.currentEmail`, `profile.verified`, `profile.unverified`, `profile.newEmail`, `profile.changeEmail`, `profile.emailChangeSent`, `profile.emailChangedUnverified`, `profile.emailChanged`, `profile.passwordSection`, `profile.currentPassword`, `profile.newPassword`, `profile.confirmPassword`, `profile.changePassword`, `profile.setPassword`, `profile.setPasswordNote`, `profile.passwordSaved`, `profile.password_too_short`, `profile.password_too_long`, `profile.password_mismatch`, `profile.already_has_password`, `profile.saveFailed`, `verify.banner`, `verify.resend`, `verify.sent`, `verify.done`, `login.checkEmail`.

- [ ] **Step 1:** Failing test `password.test.ts`: `("short","short")` -> `password_too_short`; `("longenough","different1")` -> `password_mismatch`; `("longenough","longenough")` -> null; 129-char equal pair -> `password_too_long`.
- [ ] **Step 2:** `cd apps/web; bun test src/lib/password.test.ts` - FAIL.
- [ ] **Step 3:** Implement `password.ts`, api functions, i18n keys (no em/en dashes).
- [ ] **Step 4:** Test PASS; `bun run typecheck` PASS.
- [ ] **Step 5: Commit** `feat(web): add profile client helpers and copy`

### Task 5: Navbar link + verify banner + sign-up callback

**Files:**
- Create: `apps/web/src/components/VerifyEmailBanner.tsx`
- Modify: `apps/web/src/components/Navbar.tsx`, `apps/web/src/pages/LoginPage.tsx:52`, `apps/web/src/pages/HomePage.tsx`, `apps/web/src/styles.css`

**Interfaces:**
- Consumes: i18n `verify.*`, `nav.profile`, `login.checkEmail` from Task 4.
- Produces: `VerifyEmailBanner(): JSX.Element | null`

- [ ] **Step 1:** Navbar: replace `<span className="topbar-user">` with `<NavLink to="/profile" className={({isActive}) => \`topbar-user nav-link ${isActive ? "active" : ""}\`} title={t("nav.profile")}>`. Render `<VerifyEmailBanner />` right after the `.topbar` div (wrap both in a fragment).
- [ ] **Step 2:** Banner: renders null unless `session.user.emailVerified === false`. Resend calls `authClient.sendVerificationEmail({ email, callbackURL: \`${window.location.origin}/app?verified=1\` })`, then shows `verify.sent` and disables the button for 60 s (`setTimeout` cleared on unmount). Error inline.
- [ ] **Step 3:** LoginPage sign-up passes `callbackURL: \`${window.location.origin}/app?verified=1\``.
- [ ] **Step 4:** HomePage: if `useSearchParams` has `verified=1`, show `verify.done` notice once and remove the param with `setSearchParams({}, { replace: true })`.
- [ ] **Step 5:** CSS for `.verify-banner` (full width, warm accent, wraps on mobile) and `.notice-success`.
- [ ] **Step 6:** `bun run typecheck` PASS. Manual: register new user, banner shows; click logged link, lands on `/app?verified=1`, notice shows, banner gone.
- [ ] **Step 7: Commit** `feat(web): link profile from navbar and add verify email banner`

### Task 6: Profile page

**Files:**
- Create: `apps/web/src/pages/ProfilePage.tsx`
- Modify: `apps/web/src/App.tsx` (signed-in `<Route path="/profile" element={<ProfilePage />} />`; signed-out `/profile` -> `<Navigate to="/login" replace />`), `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `authClient` (`updateUser`, `changeEmail`, `changePassword`), `useSession` (`refetch`), `api.getAccount`, `api.setPassword`, `validateNewPassword`, i18n `profile.*`, `playPop`.

- [ ] **Step 1:** Page layout: `<Navbar />`, `.container`, `.page-head` with `profile.title`, three `.profile-card` sections, each a `<form>` with its own `busy`, `error`, `success` state.
- [ ] **Step 2:** Name card: prefilled from session; `authClient.updateUser({ name: name.trim() })`; empty name blocked by `required`; on success `refetch()`, `playPop()`, `profile.nameSaved`.
- [ ] **Step 3:** Email card: current email + badge (`profile.verified` / `profile.unverified`). `authClient.changeEmail({ newEmail, callbackURL: \`${origin}/profile?emailChanged=1\` })`. Success message: `profile.emailChangeSent` if currently verified, else `profile.emailChangedUnverified` + `refetch()`. `?emailChanged=1` shows `profile.emailChanged` once, then clears the param and refetches.
- [ ] **Step 4:** Password card: load `api.getAccount()` on mount (spinner while loading). `validateNewPassword` first; error key mapped to `t("profile." + key)`. `hasPassword`: `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`. Else: show `profile.setPasswordNote`, call `api.setPassword(newPassword)`, then set `hasPassword=true`. Clear fields on success. Server error codes from `/me/password` map through `profile.<code>` with fallback `profile.saveFailed`; better-auth errors show `error.message`.
- [ ] **Step 5:** CSS: `.profile-card`, `.badge`, `.badge-ok`, `.badge-warn`; single column, max width ~560px, inputs full width on mobile.
- [ ] **Step 6:** `bun run typecheck` and `bun test` in both apps PASS.
- [ ] **Step 7: Manual QA (empty SMTP_HOST, links from API console):** change name; wrong current password shows error; correct change works and other sessions logged out; change email to an address already used shows error; change email as verified user, click link, lands on `/profile?emailChanged=1` with new email; Google user sets password then signs out and signs in with email + password; second set-password attempt impossible (form switches to change mode). Check EN and ID copy and mobile width.
- [ ] **Step 8: Commit** `feat(web): add profile page with name, email and password`
