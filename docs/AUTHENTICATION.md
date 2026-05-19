# Authentication & MFA — InsightHub

> **Compliance reference:** USZoom Policy **3692** Authentication & Password (AUTH-02, AUTH-06) and Policy **3691** Access Control (AC-05).
> **Gap:** G-02 — closed 2026-05-19 (full scope: AMR check + admin gate + persisted timestamp + admin-UI surface).
> **Owner:** Jeff Coy.
> **Annual review due:** 2027-05-19.

---

## What we enforce, in one paragraph

InsightHub authenticates users via Google OAuth (Google Workspace, `@uszoom.com` domain only). On every sign-in we parse the Google OIDC `id_token` for the `amr` (Authentication Methods References) claim. If the user's effective role is **ADMIN** or **POWER_USER** and `amr` does not include an MFA-grade value (`mfa`, `otp`, `hwk`, `swk`, etc.), the sign-in is rejected and the user is redirected to `/auth/mfa-required` with instructions to complete 2-step verification with Google. We persist `User.mfaVerifiedAt` on every MFA-bearing sign-in, surface a badge on the admin users page (✅ verified / ⚠️ stale >7d / 🔓 missing-required-MFA), and emit an audit log entry on every rejection.

## Why this layer, given Google Workspace already enforces MFA?

Three reasons an auditor will be satisfied by, and a delegate-to-Google posture will not:

1. **Evidence visibility.** Policy 3692 wants to see *InsightHub itself* assert MFA, not just Google. An auditor reading `src/lib/auth/config.ts` will find the explicit gate; reading `docs/AUTHENTICATION.md` will find the rationale; reading the audit log will find rejection records.
2. **Defence in depth.** If Google Workspace MFA policy is misconfigured, downgraded, or bypassed (compromised admin, policy regression, custom-app exemption), InsightHub still refuses to admit a privileged user without MFA.
3. **Role-aware enforcement.** Google can't natively distinguish "VIEWER is signing in" from "ADMIN is signing in" — but our app can. We enforce strictly on ADMIN/POWER_USER (where the blast radius is large) and merely *record* on lower roles (where the cost of refusing a fresh-but-MFA-less sign-in would interfere with day-to-day use).

## The full authentication chain

```
1. User clicks "Sign in with Google" on /login
   └── src/app/login/page.tsx

2. NextAuth GoogleProvider handles the OAuth dance
   └── src/lib/auth/config.ts — `providers[0]`

3. Google returns an id_token (JWT) signed by Google. NextAuth verifies the
   signature, issuer, audience, and expiry. We trust those checks.

4. The `signIn({ user, account })` callback runs:
   └── src/lib/auth/config.ts:57
       ├── Domain check: email must end in @uszoom.com    (existing)
       ├── Resolve effective role (allowlist ∪ DB)        (G-02)
       ├── Parse id_token.amr via parseIdTokenAMR()       (G-02)
       └── If requiresMfa(role) && !mfaVerified:
            ├── Emit USER_LOGIN audit { outcome:'rejected', reason:'mfa_required', ... }
            ├── Log warning to stderr (operator visibility)
            └── return '/auth/mfa-required'  → user sees the explainer page

5. The `jwt({ token, user, account })` callback runs (only on accepted sign-ins):
   └── src/lib/auth/config.ts:122
       ├── Find-or-create the User row
       ├── Persist lastLoginAt = now()
       ├── If MFA was asserted on this sign-in: persist mfaVerifiedAt = now()
       │   (we never null out a previous verification — only refresh forward)
       ├── Set token.{sub, role, department, hasOnboarded, mfaVerified}
       └── Log USER_LOGIN audit success

6. The `session({ session, token })` callback exposes those fields to the
   client-side session.
```

## Operator runbook

### First-login bootstrap

The very first time someone in `ADMIN_EMAILS` signs in, there is no User row in the DB yet. The `signIn` callback handles this by falling back to the allowlist to determine effective role *before* a DB row exists. MFA is enforced from day one.

### Granting a new user POWER_USER or ADMIN role

After the user has signed in once (creating their User row as VIEWER):

```bash
# Bump their role via the admin UI at /admin/users, or via Prisma:
npx prisma studio
# Set User.role = 'ADMIN' or 'POWER_USER'
```

Their NEXT sign-in must include MFA. Existing sessions are NOT immediately revoked — they'll expire at the 8h JWT TTL (configured in `src/lib/auth/config.ts`). If you need to force a re-sign-in, you can delete their row from the NextAuth session table or rotate `NEXTAUTH_SECRET` (nuclear option — invalidates everyone).

### Forcing a fresh MFA assertion

If a privileged user's `mfaVerifiedAt` is stale (>7d), the admin badge surfaces this with an amber ⚠️. The user is not immediately blocked — they finish their current 8h session and then must MFA again on next sign-in (because Google's session may also have aged out). To force-fresh:

1. Have the user sign out of InsightHub (cookie cleared).
2. Have them sign out of Google completely (https://accounts.google.com/Logout).
3. Have them sign back in — Google will prompt for the second factor, our AMR check will see `mfa` in the claim, and the badge flips back to green ✅.

## Stakeholder talking points (for tomorrow's CISO review)

When JD/Lior/Avi ask **"How do you know MFA is being enforced?"**, you can point at:

1. **The code.** `src/lib/auth/config.ts` line 76 parses the AMR claim. Line 93 has the explicit `if (requiresMfa(effectiveRole) && !amr.mfaVerified)` reject. Show it on screen.
2. **The data.** Open `/admin/users` and show the MFA badge column. Anyone with ✅ in the last 7 days has demonstrably authenticated with MFA. Anyone with 🔓 in a privileged role is a defect — let's find one if there is one.
3. **The audit log.** Filter by `action=user.login` and `metadata.outcome=rejected` — every rejected sign-in attempt is a record proving the gate fired.
4. **The defence in depth.** Google enforces MFA at the IdP layer. InsightHub independently enforces MFA at the application layer using the AMR claim. Both have to be misconfigured for an MFA-less privileged sign-in to occur.

When they ask **"What if Google's id_token doesn't include AMR?"**, the honest answer:

- For Google Workspace OIDC, AMR IS included when the user actually performed an MFA step in this Google session. If Google's session is cached and MFA was performed >N hours ago, AMR may be omitted.
- Our policy is: missing AMR = no MFA assertion = blocked for privileged roles. The user is asked to sign out of Google and sign back in (which re-prompts MFA). This is annoying once a day at worst, but it is correct.
- We do NOT try to read `auth_time` and grant a grace period — that would be a soft enforcement, and the gap document explicitly calls for hard enforcement.

When they ask **"What about non-Google sign-ins (the dev provider)?"**:

- The `CredentialsProvider` only activates when `NEXT_PUBLIC_DEV_MODE === 'true'`. Production sets this to `false` (verified in `src/lib/env.ts` validator). In dev mode there is no MFA — but in dev mode we also have no real user data. Mention this proactively so they don't catch it as a gotcha.
- **Open follow-up:** `NEXT_PUBLIC_DEV_MODE` is currently `true` in production per the existing G-38 evidence in COMPLIANCE_GAPS.md. That is a separate gap and is the highest-priority remaining Tier-2 item. Flagging it ourselves builds credibility.

## Pending follow-ups (post-2026-05-19)

- **G-02b (Tier-2):** Step-up MFA challenge for sensitive in-app actions (user deletion, role grants, retention purges) using a TOTP secondary factor stored per-user. Today's gate only fires at *sign-in time*; an attacker who steals an active session cookie bypasses MFA until the cookie expires (8h).
- **G-11 (Tier-2):** Admin uses a separate account for privileged actions. Today Jeff's everyday account is the admin account. Resolving G-11 will pair naturally with G-02b.
- **Hardware-key requirement for ADMIN role on production access:** policy 3692 hints at this for the most privileged accounts. Action: enforce that Jeff's macOS SSH access to EC2 uses a YubiKey via `ssh-add -K`, and document the chain.

## File map

| Path | Purpose |
|---|---|
| `src/lib/auth/config.ts` | NextAuth config; signIn callback enforces MFA; jwt callback persists mfaVerifiedAt |
| `src/lib/auth/mfa.ts` | AMR parsing helpers; `parseIdTokenAMR`, `requiresMfa`, MFA-grade AMR values |
| `src/lib/auth/session.ts` | `getCurrentUser`, `isAdmin` (unchanged today) |
| `src/app/auth/mfa-required/page.tsx` | Explainer page shown on MFA-rejection |
| `src/app/admin/users/users-client.tsx` | MFA badge column (green ✅ / amber ⚠️ / red 🔓) |
| `src/app/api/admin/users/route.ts` | Returns `mfaVerifiedAt` in the admin users list |
| `prisma/schema.prisma` | `User.mfaVerifiedAt: DateTime?` |
| `docs/AUTHENTICATION.md` | This document |
