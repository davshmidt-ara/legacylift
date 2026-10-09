# Putting LegacyLift online

The site has two parts:

- **The website.** A static web app: everything in `dist/` after `npm run build`. It can be hosted anywhere.
- **The backend.** A Supabase project holds the accounts, the database and the `business-ai` function. The site finds it through the three lines in `.env`.

Do them in this order: backend (section 1), then website (section 2), then check (section 3).

---

## 1. Backend: Supabase (about 15 minutes, once)

### a. Create LegacyLift's own Supabase project

`.env` still points at the Supabase project shared with the Noah site (`xfqlcjdywkfvrkipbunr`). To keep LegacyLift fully separate, give it its own project:

1. At [supabase.com/dashboard](https://supabase.com/dashboard), click **New project**.
2. Name it `legacylift`, and choose a strong database password. Save the password; you'll need it later.
3. For **Region**, pick **Europe (Frankfurt)** or **Europe (Stockholm)**. That keeps client data in the EU, which Baltic clients will ask about.
4. When it's ready, open **Project Settings → API** and copy:
   - the **Project URL** (`https://<ref>.supabase.co`)
   - the **anon / publishable key**
5. On GitHub, open `.env` in this repository and click the pencil icon to edit it. Put in the new values, then click **Commit changes**:

   ```
   VITE_SUPABASE_PROJECT_ID=<ref>
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
   ```

   These keys are meant to be public. The database rules decide what each person can see.

### b. Create the database tables

In the new project, open **SQL editor → New query**. Run these two files, in this order, once each (paste the whole file, click **Run**):

1. `supabase/migrations/20260927120000_legacylift_cloud.sql`: clients, workspaces and who may see what.
2. `supabase/migrations/20261009120000_accounts_and_sign_up.sql`: open sign-up, Google and Microsoft accounts, self-service business set-up, and the private account register.

### c. Sign-in settings

In **Authentication**:

- **Sign In / Providers → Email:** keep **Confirm email** on.
- **URL Configuration:** set **Site URL** to your website's address, e.g. `https://davshmidt-ara.github.io/legacylift`. Add every address the site runs on to **Redirect URLs**, each ending in `/**`:
  - `https://davshmidt-ara.github.io/legacylift/**`
  - `https://your-domain.lv/**` (once you have one)

Google and Microsoft both send people back to Supabase first, at this address. You'll need it in the next two steps:

```
https://<ref>.supabase.co/auth/v1/callback
```

### d. "Continue with Google" (about 10 minutes)

1. Open [console.cloud.google.com](https://console.cloud.google.com) and create a project named `LegacyLift`.
2. Go to **APIs & Services → OAuth consent screen**:
   - Choose **External**.
   - App name: `LegacyLift`, plus your support email.
   - Under **Authorized domains**, add `supabase.co`, and your own domain if you have one.
   - Save, then click **Publish app** so anyone can sign in, not only test users.
3. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Type: **Web application**.
   - Under **Authorized redirect URIs**, add the callback address above.
   - Click **Create**, and copy the **Client ID** and **Client secret**.
4. In Supabase, go to **Authentication → Sign In / Providers → Google**. Turn it on, paste the ID and secret, and save.

### e. "Continue with Microsoft" (about 10 minutes)

Supabase calls this provider **Azure**. It covers both work accounts (Microsoft 365) and personal ones (Outlook, Hotmail).

1. Open [portal.azure.com](https://portal.azure.com) and go to **Microsoft Entra ID → App registrations → New registration**.
   - Name: `LegacyLift`.
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
   - Redirect URI: type **Web**, then the callback address above.
   - Click **Register**, and copy the **Application (client) ID**.
2. Go to **Certificates & secrets → New client secret**, choose 24 months, and copy the secret's **Value**. It is shown only once.
3. Go to **Token configuration → Add optional claim**, choose **ID**, and tick **email** and **xms_edov**. When asked, allow the Microsoft Graph permission. `xms_edov` tells Supabase whether Microsoft has verified the address. LegacyLift only lets a Microsoft account accept an invite, or be added to the team, when it has.
4. In Supabase, go to **Authentication → Sign In / Providers → Azure**. Turn it on and paste the client ID and secret. Leave the tenant URL empty: that means "any Microsoft account". Save.
5. Put a reminder in your calendar to make a new secret before this one expires (step 2).

Until each provider is switched on, its button tells people "This sign-in option isn't switched on yet" and email sign-up still works.

### f. Turn on the AI

The AI runs in the `business-ai` function, which calls the Claude API. Get an API key at [console.anthropic.com](https://console.anthropic.com).

**Easiest: from GitHub.** In this repository, go to **Settings → Secrets and variables → Actions** and add:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `SUPABASE_PROJECT_REF` | the project ref from step a |
| Secret | `SUPABASE_ACCESS_TOKEN` | supabase.com → your avatar → **Account → Access tokens → Generate** |
| Secret | `SUPABASE_DB_PASSWORD` | the database password from step a |
| Secret | `ANTHROPIC_API_KEY` | your Claude API key |
| Variable | `AI_ALLOWED_ORIGINS` | your site address(es), comma-separated |

Then go to **Actions → Supabase backend → Run workflow**. This also applies the database tables, so step b is then optional.

**Or from a terminal:**

```sh
supabase secrets set --project-ref <ref> ANTHROPIC_API_KEY=sk-ant-... AI_ALLOWED_ORIGINS=https://your-domain.lv
supabase functions deploy business-ai --project-ref <ref>
```

Without a key, the AI features run in "Demo mode".

---

## 2. Website: pick one host

### Option A: Vercel (easiest, about 5 minutes, all in the browser)

1. Go to [vercel.com](https://vercel.com) and choose **Sign up → Continue with GitHub**.
2. Click **Add New… → Project**. Find this repository in the list and click **Import**. If it isn't listed, click **Adjust GitHub App Permissions** and allow it.
3. Leave every setting as it is. `vercel.json` already has them. Click **Deploy**.
4. About a minute later the site is live at `https://<name>.vercel.app`.
5. To use your own domain, open the project's **Settings → Domains**, add the domain, and copy the DNS records it shows to your domain registrar.

From then on, every change to `main` is published automatically.

### Option C: GitHub Pages (free, no extra account)

`.github/workflows/pages.yml` publishes every change to `main` to `https://<owner>.github.io/<repo>/`.

1. On a free GitHub plan the repository must be public: **Settings → General → Danger Zone → Change visibility → Public**.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Actions → GitHub Pages → Run workflow** (or push any change to `main`).
4. In Supabase → **Authentication → URL Configuration**, add `https://<owner>.github.io/<repo>/**` to **Redirect URLs**.

### Option B: Google Firebase Hosting

1. At [console.firebase.google.com](https://console.firebase.google.com), click **Create a project**, e.g. `legacylift-prod`. Note the **project ID**.
2. In the project, go to **Build → Hosting → Get started**. You can skip the command-line steps it shows.
3. On any computer with Node.js, inside this repository, run:

   ```sh
   npx firebase-tools login
   npx firebase-tools init hosting:github
   ```

   Keep `firebase.json` and the existing workflows when it asks. This creates the `FIREBASE_SERVICE_ACCOUNT` secret on GitHub for you.
4. On GitHub, go to **Settings → Secrets and variables → Actions → Variables** and add `FIREBASE_PROJECT_ID` = your project ID.
5. The next change to `main` is tested and published to `https://<project-id>.web.app`. To publish straight away, open **Actions → Website → Run workflow**.
6. To use your own domain: **Hosting → Add custom domain**.

---

## 3. Make yourself the admin, then check it works

1. Open `https://<your site>/internal` → **Create account**. Confirm the email, then sign in.
2. The page shows one SQL line with your email already filled in. Run it in Supabase → **SQL editor**, then click **Check again**. You're the admin.
3. Click **Add client** and invite a second email address of yours under **Client access**.
4. In a private window, sign in with that second email at `/app`. The client's workspace opens.
5. Write an invoice there. Within a second, the sidebar shows "All changes saved".
6. Open the same client in the console. The invoice is there.
7. In **Digitize paper**, paste some invoice text and extract it. With the AI key set you get a real AI result; without it, "Demo mode".
8. Sign up once with Google and once with Microsoft (private windows). Each time you get **Set up your business**: enter a name, and the workspace opens.
9. Back in the console, **Accounts** lists both new accounts with how they signed in. **Clients** shows their businesses as new leads, marked **Website sign-up**.

---

## 4. Where to find the internal side, and who can see what

| What | Where | Who can open it |
| --- | --- | --- |
| Team console: clients, checklists, activity log, each client's workspace | `https://<your site>/internal` (now `https://davshmidt-ara.github.io/legacylift/internal`) | Only people on the team (the **Team** page) |
| **Accounts**: everyone who has signed up, how (email, Google, Microsoft), when, last sign-in, and their business | Console → **Accounts**. **Export CSV** downloads the list | Only people on the team |
| The raw tables | supabase.com → your project → **Table Editor** (pick schema `internal` for the account register) | Only the owners of the Supabase project |

How the information stays confidential:

- **The account register is locked away.** It lives in its own section of the database (`internal.accounts`), which the website's API does not expose and which has no access rules at all. No browser can read it, not even a team member's. The console's Accounts page reads it only through `account_register()`, which first checks that the person is on the team.
- **Each client sees only their own business.** A client sees only the workspace of the business they set up or were invited to. Clients never see the client list, internal notes, the activity log or other accounts. The database enforces this, not the website, and `supabase/tests/` checks it on every rule.
- **Passwords** are handled by Supabase and never stored by LegacyLift. With Google or Microsoft, LegacyLift never sees a password at all.
- **Search engines** are kept out of `/app` and `/internal`.
- **Data location.** Pick an EU region for the Supabase project (step 1a) so client data stays in the EU.
