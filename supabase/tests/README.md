# LegacyLift database tests

These check the access rules in `../migrations/20260927120000_legacylift_cloud.sql` against a real Postgres, and the app's cloud code (`src/features/cloud/api.ts`) against a real REST API. **Local only: never run them against the live Supabase project.**

## Access rules (Postgres only)

```sh
createdb ll
psql -d ll -f 00_local_supabase_stub.sql          # stand-in for Supabase's auth schema and roles
psql -d ll -f ../migrations/20260927120000_legacylift_cloud.sql
psql -d ll -f legacylift_access_test.sql           # prints "ok …" per check, ends with ALL SQL TESTS PASSED
```

This covers the staff, client, stranger, unconfirmed-account and logged-out cases: who can read, save, invite and delete, version checks on saving, and that TRUNCATE and direct inserts are refused.

## App code against a real API (Postgres + PostgREST)

1. Create a database as above, but without running the test script. Then add the login role and test users:

   ```sql
   create role authenticator login password 'authpw' noinherit;
   grant anon, authenticated to authenticator;
   insert into auth.users values
     ('00000000-0000-0000-0000-00000000000a','owner@agency.test',now()),
     ('00000000-0000-0000-0000-00000000000c','maria@bakery.test',now()),
     ('00000000-0000-0000-0000-00000000000d','klaus@joinery.test',now());
   insert into public.staff (user_id, display_name) select id, 'Owner' from auth.users where email = 'owner@agency.test';
   ```

2. Run [PostgREST](https://postgrest.org) with `jwt-secret = "local-test-secret-that-is-at-least-32-chars-long"`, `db-anon-role = "anon"` and a `db-uri` for the `authenticator` role. Serve it under `/rest/v1` (a tiny proxy works).
3. From the repo root:

   ```sh
   LL_REST_URL=http://127.0.0.1:<proxy port> npx vitest run src/features/cloud/api.integration.test.ts
   ```
