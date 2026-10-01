# LegacyLift

Digital tools and AI for established firms: invoicing, customers, stock and paperwork for family businesses, workshops and traditional firms, with AI that does the typing.

## Run it on your computer

You need Node.js 20 or newer.

```sh
npm ci
npm run dev
```

Then open http://localhost:8080. The Supabase project it connects to is set in `.env` (see `.env.example`).

## What's in it

A business app that helps established, paper-based firms go digital, with AI built in.

- `/` — product landing page
- `/app` — the workspace, in two parts:
  - **Run the business** (works fully without AI)
    - **Overview** — money received per month, what's awaiting payment and overdue, and a "needs attention" list
    - **Invoices & quotes** — numbered invoices and quotes with tax, printable letterhead layout (Print / PDF), email, mark sent/paid, quote → invoice, duplicate, CSV export
    - **Customers** — contact book with notes, paid-to-date / outstanding totals and full invoice history
    - **Stock** — materials with reorder levels; stock linked to invoice lines is booked out when the invoice is sent
    - **Settings** — business details for the letterhead, tax rate, payment terms, number prefixes, backup download/restore
  - **AI tools**
    - **Digitize paper** — photos, PDFs or text become records; optionally also a customer and a tracked invoice
    - **Documents** — searchable archive of everything digitized
    - **Assistant** — answers questions from the firm's customers, invoices, stock and documents
    - **Writer** — reminders, quotes and letters (overdue invoices and low stock pre-fill it)
    - **Digital roadmap** — maturity check-up and phased plan

- `/internal` — **internal operations console for our team** (not linked from the public pages): client list with package and stage, a service checklist per package whose tasks tick themselves off from the client's data, an activity log, and each client's own full workspace that the team runs on the client's behalf.

Full list of functions with the code behind each: [`docs/LEGACYLIFT_FUNCTIONS.md`](docs/LEGACYLIFT_FUNCTIONS.md).

Code lives in `src/features/digital/`, `src/features/ops/`, `src/features/cloud/` and `src/pages/digital/`.

## Accounts and shared data

- **Clients** sign in at `/app` and their business opens. They can only ever see their own firm.
- **Our team** signs in at `/internal` and sees every client, the checklists and the activity log.
- Data lives in Supabase, one workspace per firm. It saves automatically, and the sidebar says "All changes saved". If two people save at the same moment, their changes are combined item by item.
- **Without an account** ("Try it without an account" / "demo mode"), everything stays in that browser only, as before.

## Hosting

Step-by-step guide to putting the site online with Vercel or with Google Firebase Hosting, plus the one-time backend steps: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). With Firebase, every merge to `main` is tested and published automatically by `.github/workflows/deploy-web.yml`.

## Going live: one-time setup

1. **Apply the database migration** `supabase/migrations/20260927120000_legacylift_cloud.sql`. Paste it into Supabase → SQL editor and run it, or with the Supabase CLI run `supabase db push`.
2. **Keep "Confirm email" on**: Supabase → Authentication → Providers → Email. Invites rely on it.
3. **Allow the app's address for sign-in emails**: Supabase → Authentication → URL Configuration. Add your site, e.g. `https://your-site.com/**`, so confirmation and password-reset links come back to LegacyLift.
4. **Create your account** at `/internal` → *Create account*, confirm the email, and sign in. The page shows a single SQL line with your email filled in. Run it once in Supabase → SQL editor, then click *Check again*. You're the admin.
5. **Add colleagues** under *Team* once they have created an account.
6. **Add a client and invite them**: in the client file, go to *Client access* → enter their email → *Invite* → send them the message it prepares.

## Enabling AI

AI runs in the `business-ai` Supabase Edge Function (`supabase/functions/business-ai`), which calls the Claude API. Set the key and deploy:

```sh
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set AI_ALLOWED_ORIGINS=https://your-site.com   # recommended
supabase functions deploy business-ai
```

By default only signed-in team members and client users can use the AI. Everyone else, including people trying the app without an account, gets the built-in demo helpers, labelled as such. Other settings:

- `AI_RATE_LIMIT`: per person per 10 minutes, default 40.
- `AI_ALLOW_ANONYMOUS=true`: answers people who aren't signed in; only for a public demo site.

## Tests

- `npm test`: app and sync tests.
- `supabase/tests/`: database access-rule tests and a real-database integration test for the app's cloud code. See `supabase/tests/README.md`.
