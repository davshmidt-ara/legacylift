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

In the new project, open **SQL editor → New query**. Paste the whole of `supabase/migrations/20260927120000_legacylift_cloud.sql`, click **Run**, and run it once.

### c. Sign-in settings

In **Authentication**:

- **Sign In / Providers → Email:** keep **Confirm email** on.
- **URL Configuration:** set **Site URL** to your website's address. Add every address the site runs on to **Redirect URLs**, for example:
  - `https://legacylift.vercel.app/**`
  - `https://your-domain.lv/**`

### d. Turn on the AI

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
