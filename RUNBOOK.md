# Runbook: Gize Admin Portal

How to release, undo, configure and look after the hosted portal (GZW-072). The backend has its own runbook (`gize-admin-api/RUNBOOK.md`); this one covers the portal only. Background: README "Deployment" and architecture.md "Deployment".

## At a glance

|                    | Staging                                                     | Production                                             |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------------------ |
| Address            | `https://staging-admin.gizetransport.com`                   | `https://admin.gizetransport.com`                      |
| Cloudflare Worker  | `gize-admin-staging` (`wrangler.jsonc`, `env.staging`)      | `gize-admin` (`wrangler.jsonc`, top level)             |
| Deployed           | Automatically, on every merge to `main`                     | After the owner approves the **Release** run           |
| GitHub environment | `staging` (no protection)                                   | `production` (reviewer: the owner; branch `main` only) |
| API                | `https://gize-api-staging.onrender.com`                     | `https://gize-api-production.onrender.com`             |
| Sign-in (Supabase) | project `pahktmbnbyulqkhdruci`                              | project `sxdsoaxzmqrqrjcgpcoq`                         |
| Staff accounts     | Staging's own                                               | Production's own (invited from production)             |
| PR previews        | Yes: `pr-<number>-gize-admin-staging.<account>.workers.dev` | None                                                   |

Each site is its own build: the `NEXT_PUBLIC_*` values are baked in, so a site only changes when it is built and deployed again. Its security policy lets the browser talk only to the site itself, its own API, its own Supabase project and (when set) Sentry.

## Releasing a change

1. Merge the PR once all 8 checks pass (CLAUDE.md).
2. About 10 minutes later, main's **CI** run has deployed it to **staging-admin**. Check it there (reload open tabs).
3. In GitHub, **Actions → Release**: the run for that commit shows **Waiting**. Open it, press **Review deployments**, tick **production**, then **Approve and deploy**. A few minutes later the run's summary says "Released `<commit>` to https://admin.gizetransport.com".

- **Several runs waiting:** approve the newest. A release deploys only `main`'s newest commit; an older one approved later deploys nothing and says so ("Nothing released: main has moved on…"). Older waiting runs can be left or cancelled.
- **Never** deploy by hand (no `wrangler deploy` from a laptop) and never press Cloudflare's own deploy buttons: the next release would undo it, and nothing in GitHub records it. The one exception is the emergency rollback below.

## Undoing a release

- **Normal way:** revert the PR on GitHub (**Revert** button on the merged PR), merge the revert once its checks pass, then approve its **Release** as above. Re-running an older release deploys nothing.
- **Emergency (production broken and the revert can't wait):** Cloudflare dashboard → **Workers & Pages → gize-admin → Deployments** → pick the previous version → **Rollback**. It switches the Worker (pages and files) back within seconds, and the address stays as it is. GitHub doesn't record it, so revert on `main` as above straight after; otherwise the next release brings the broken version back.

## Changing a site's settings

The settings are GitHub **environment variables** (Settings → Environments → `staging` or `production`): `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and optionally `NEXT_PUBLIC_SENTRY_DSN` (error reporting, off while unset). They are public (they reach every browser); never put a secret in them, least of all in `staging` (PR code can read it).

A change only takes effect at the next build of that site:

- **Staging:** Actions → **CI** → the run for `main`'s newest commit → open the **Deploy (Cloudflare)** job → **Re-run this job**. It reads the current settings; the other checks keep their earlier results. When it succeeds, a new **Release** run waits: approve it only if production should change too.
- **Production:** Actions → **Release** → the run for `main`'s newest commit (not a skipped one) → **Re-run all jobs**, then approve it. It reads the current settings. GitHub allows re-runs for 30 days; for an older run, merge any change to start a new one.

A missing value stops the deploy at **… settings present?** with "`<name>` is not set in the `<environment>` environment." A wrong one (an `http://` address, or a `sb_secret_…` key) gets past that and stops the build with "Invalid public environment variables".

The publishable key must be the `sb_publishable_…` key of that site's own Supabase project (the portal refuses a `sb_secret_…` key). To check a key belongs to a project: `curl -H "apikey: <key>" https://<project>.supabase.co/auth/v1/settings` answers 200 for its own project and 401 for another.

## When a deploy or release fails

Open the failed run and the failed step:

| Step that failed                                                                                            | Usual cause and fix                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Staging / Production settings present?**                                                                  | A variable is missing in that environment. Add it (above) and re-run.                                                                                                                             |
| **Build the Worker** ("Invalid public environment variables")                                               | A setting has a wrong value: not `https`, or a secret key instead of the publishable one. Correct it and re-run.                                                                                  |
| **… keeps to its own address**                                                                              | `wrangler.jsonc` was changed so a Worker would claim the other site's address (or none). Fix the config in a PR; never remove this check.                                                         |
| **Deploy to …**                                                                                             | Cloudflare refused: the token expired (2027-11-10) or lacks a permission, or Cloudflare is having trouble. The log names it. See "Cloudflare token" below, or re-run later.                       |
| **Check staging-admin / admin.gizetransport.com**                                                           | The site didn't answer with its security headers within about 10 minutes. On a brand-new address, the certificate can take that long: re-run. Otherwise open the site and look at what it serves. |
| **Still main's newest commit?** (a warning, "Nothing released: main has moved on…"; the run still succeeds) | Not a failure: nothing was deployed. Approve the newest run instead.                                                                                                                              |

After a failed staging deploy, that commit's **Release** run is skipped. Re-running the fixed job (or the next successful CI run on `main`) starts a new one.

## Cloudflare token

`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are repository secrets, used only by the deploy steps. The token is scoped to Workers scripts, Workers Routes, DNS edit and Zone read on `gizetransport.com`, and **expires on 2027-11-10**.

To renew it (before it expires, or if it may have leaked): Cloudflare dashboard → **My Profile → API Tokens** → create a token with the same permissions (or **Roll** the existing one) → in GitHub, **Settings → Secrets and variables → Actions** → update `CLOUDFLARE_API_TOKEN` → re-run the latest Deploy and Release. Then delete the old token in Cloudflare.

Anyone with write access to the repository can reach this token through a PR's own workflow, and with it deploy either site without an approval: give write access only to people trusted with production.

## Sign-in and email (Supabase, per project)

Each Supabase project has its own staff accounts and its own Auth settings (README "Supabase Auth settings"):

- **Site URL** is the site's address (above). **Redirect URLs:** production `https://admin.gizetransport.com/**` only; staging `https://staging-admin.gizetransport.com/**` and `http://localhost:3000/**` (local development).
- **Templates** (Invite user, Reset password) are the same in both projects; their links and logo come from the Site URL.
- **Minimum password length 12** in both (the portal checks the same; owner decision 2026-11-10 and 2026-11-24).
- **SMTP** (Zoho, free plan): host `smtp.zoho.com` (not `smtppro.zoho.com`, which Zoho refuses with "554 5.7.8 Access Restricted"), port `465`, the same mailbox as sender and username, and a Zoho **app password** per project. Zoho allows the mailbox about 50 emails a day, shared by both projects and the mailbox's own mail.

**"The invitation email couldn't be sent" or "Couldn't send the link":** Supabase couldn't send the email. The reason is in that project's **Logs → Auth** (newest error, its `error` line): `535` wrong or normal password (use an app password), `553` sender and username differ, `554 … Access Restricted` wrong host, or a daily limit. Trying again is safe: nobody gets two accounts.

**Staff** sign in with an account of that site's own project; staging passwords don't work on production. Admins invite others from the **Staff** screen.

## Other things to know

- **A brand-new address** (like staging-admin on 2026-11-22) can show "site can't be reached" on a network that looked it up before it existed: routers keep that answer for up to 30 minutes. Mobile data or a public DNS (1.1.1.1) shows it straight away.
- **HTTPS:** Cloudflare's "Always Use HTTPS" sends `http://` visitors to `https://` on both sites, and the portal sends HSTS.
- **The APIs' allowed addresses** (`CORS_ALLOWED_ORIGINS`, backend): production's lists `admin.gizetransport.com` only, staging's `staging-admin.gizetransport.com` (and `admin.gizetransport.com` until the backend removes it, its RUNBOOK step 12). A site whose address is missing loads, but every list fails to load.
- **Free plans:** the backends run on free Render and Supabase plans (until about May 2027): Supabase pauses a project after about a week without activity and has no automatic backups (backend RUNBOOK).
