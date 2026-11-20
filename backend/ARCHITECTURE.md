# AssertNow Backend: Architecture Rules

Read this file and ENDPOINTS.md before every task. Follow them strictly.
If a task conflicts with these rules, or anything is unclear, STOP and ask.
Do not guess or assume.

---

## 1. Stack
- Node.js LTS, TypeScript (strict mode), ESM, Express 5
- zod for validation, PostgreSQL for storage
- jsforce v3, imported ONLY inside `src/integrations/salesforce/`
- Only the approved dependencies below. Do not add any other library, file,
  route or abstraction without my written approval.

### Approved dependencies
```
runtime : express, zod, jsforce, pg, dotenv, pino (logger)
database: <DECISION PENDING: Drizzle | Prisma | Knex>  -> do not pick one yourself
queue   : <DECISION PENDING: BullMQ + ioredis | Postgres-based> -> Phase 5 only
dev     : typescript, tsx, vitest, eslint, typescript-eslint, @types/*
```
Items marked PENDING must not be installed or used until I fill them in.

---

## 2. Build phases (only the CURRENT phase is in scope)
| Phase | Scope |
|---|---|
| 1 | Skeleton: folders, server, app, config/env, errors, error handler, request logger, 404 handler, /health, lint, tsconfig |
| 2 | Salesforce adapter + 3 auth strategies (tested against a sandbox with a small script) |
| 3 | Engine with a FAKE adapter + unit tests |
| 4 | Database + modules, one per task: environments, workflows, executions, metadata, reports |
| 5 | Background worker / queue, live log stream, crash cleanup |
| 6 | Hardening: real authentication, prod-org guardrails, API limit tracking, npm audit |

Do not build anything from a later phase, even if it seems helpful.
The current phase is stated in each task.

---

## 3. Folder structure
```
backend/
├── src/
│   ├── server.ts              starts the server
│   ├── app.ts                 Express setup, mounts routes and middleware
│   ├── config/env.ts          validated env vars (ONLY place that reads process.env)
│   ├── routes/                method + path -> controller, attaches validators
│   ├── controllers/           read request, call ONE service method, send response
│   ├── services/              business logic
│   ├── models/                database queries and table shapes
│   ├── validators/            zod schemas (body, params, query) + inferred types
│   ├── engine/                graph runner, context, validation, steps/ (node handlers)
│   ├── integrations/salesforce/
│   │   ├── SalesforceAdapter.ts
│   │   ├── authFactory.ts
│   │   └── auth/  AuthStrategy.ts, clientCredentials.ts, jwtBearer.ts, refreshToken.ts
│   ├── middleware/            error handler, not-found, request logger, validate, tenant
│   └── utils/                 crypto (AES-256-GCM), errors, logger
├── migrations/                database migration files
├── docs/postman/              assertnow.postman_collection.json (Postman v2.1)
├── .env.example               every variable documented, no real values
└── .gitignore                 .env, node_modules, dist, any secrets
```

---

## 4. Request flow (always this order)
Route -> Controller -> Service -> Model (database) or Adapter (Salesforce)

| Layer | Does | Never does |
|---|---|---|
| Route | maps method + path to a controller, attaches validator | logic |
| Controller | reads request, calls ONE service method, sends response | database or Salesforce code |
| Service | business logic | touch req / res |
| Model | database queries | business logic |
| Validator | zod schemas for incoming data; exports the inferred TypeScript type (never hand-write a duplicate type) | database access |
| Adapter | Salesforce calls via jsforce | business decisions |

Workflow node types (Create, Get, Update, Delete, Decision, Assignment, Pause)
live in `engine/steps/`. They are NOT API routes.

---

## 5. Routes
1. Only routes listed under APPROVED in ENDPOINTS.md may exist.
2. One resource = one route file, standard REST verbs.
3. API prefix is `/api/v1`. `/health` is outside the prefix.
4. A temporary learning/Postman route lives ONLY in `routes/dev.routes.ts`,
   is mounted ONLY when `NODE_ENV === 'development'` (exactly that value),
   and is listed in ENDPOINTS.md under "DEV ONLY". Dev routes obey every
   production guardrail.
5. 404 handler and error handler are middleware, not routes.
6. Fixed paths (e.g. `/environments/oauth/...`) are declared before `/:id` paths.

---

## 6. Honesty and errors
1. NEVER fabricate, simulate or hardcode results. No fake PASSED steps,
   no default IDs, no default environment, no fallback workflow, no made-up durations.
2. If something is missing or fails, throw an AppError.
3. Not found = 404. Never return "the first item" instead.
4. Keep these failures separate (own error class and code each):
   - ASSERTION_FAILED: the test expectation was not met
   - SALESFORCE_ERROR: validation rule, trigger, API error returned by Salesforce
   - CONNECTION_ERROR: credentials rejected, token failed, org unreachable
   - SYSTEM_ERROR: bug or crash in our own code
5. Throw AppError subclasses only. One central error handler formats responses.
6. Response shape:
   `{ success: true, data }` or `{ success: false, error: { code, message } }`
7. Error responses never include stack traces or raw Salesforce payloads in production.

---

## 7. Security
1. Secrets, tokens and private keys are encrypted at rest (AES-256-GCM, node:crypto).
2. `ENCRYPTION_KEY` comes from `config/env.ts`, is validated at startup
   (32 bytes), and the server refuses to start without it. Never log it.
3. Never log or return secrets. Responses omit secret fields entirely.
   Do not use masking tricks or "•" comparisons.
4. No `console.log` anywhere. Use the logger. The logger and request logger must
   redact: Authorization header, and any field named like
   secret, token, password, privateKey, refreshToken, accessToken, clientSecret.
5. Config only from `config/env.ts`. CORS origins come from env
   (methods must include GET, POST, PUT, PATCH, DELETE, OPTIONS).
6. Every database query is scoped by `organizationId`.
7. `organizationId` comes from ONE place: `middleware/tenant.ts`, which for now
   reads `DEFAULT_ORG_ID` from env. This is TEMPORARY (real authentication is
   Phase 6) and must be marked with a `TODO(auth)` comment. Never hardcode an org id.
8. Create/update/delete against a Salesforce environment is blocked unless the
   environment's `allowWrites` field is true. It defaults to false. Production-tier
   environments additionally require `allowWrites` to be set explicitly by a user.
9. SOQL safety: never build SOQL by joining raw strings. Object and field names
   must match `/^[A-Za-z][A-Za-z0-9_]*$/` (and be checked against discovered
   metadata where available). Escape string values with SOQL single-quote escaping.
10. Never store secrets in JSON files or commit them to git.

---

## 8. Database
1. Schema changes go through migration files only. No auto-sync.
2. Every table has `id`, `organization_id`, `created_at`, `updated_at`.
3. Models contain queries only, always scoped by `organization_id`.

---

## 9. Salesforce adapter
1. One `AuthStrategy` interface, three implementations: `refreshToken`,
   `clientCredentials`, `jwtBearer`. Each returns `{ accessToken, instanceUrl }`.
2. Strategies obtain the token themselves, then the adapter passes
   `accessToken` + `instanceUrl` to the jsforce Connection. Do not assume jsforce
   supports every flow.
3. `authFactory` picks the strategy from the environment's `authMethod`.
4. On an expired session, refresh ONLY that environment's connection and
   retry once. Never clear other orgs' connections.
5. API version comes from config, not hardcoded.
6. No hidden global state shared between orgs. Connection cache, if any, is keyed
   by environment id.
7. No `any`. Type every function.

---

## 10. Engine (Phase 3 and 5)
1. Validate the whole graph before running: exactly one start node, no orphan
   nodes, every `{{variable}}` reference exists, valid node config.
2. The runner knows nothing about Salesforce. Node handlers use the adapter only.
3. Decision nodes choose a branch. A failing node follows its Fault Path edge if one exists.
4. Save every created record ID to the database immediately (for crash cleanup).
5. Teardown deletes in reverse order, continues on failure, and reports failures.
6. Queries and assertions support polling with a timeout, so async Salesforce
   automation is not tested too early.
7. Limits: max node count and max run time (from config). A run exceeding them fails with a clear error.
8. Runs execute in a background worker, never inside the HTTP request.
9. Store every step: input, output, timing, error, assertion verdict.

---

## 11. Code style and tooling
1. Every file starts with a 2-line comment saying what it is responsible for.
2. Functions under about 30 lines. Clear names. No clever tricks.
3. ESLint errors (not warnings) for:
   - importing `jsforce` outside `src/integrations/salesforce/`
   - `any`
   - floating (unawaited) promises
   - `console`
   - `process.env` outside `src/config/env.ts`
4. TypeScript advanced features (decorators, complex generics, type tricks) are not allowed.
   Use basic types, interfaces and zod-inferred types.

---

## 12. Testing and "done"
1. Engine code requires vitest unit tests using a FAKE Salesforce adapter.
   Cover: Decision branches, Fault Path, teardown after failure, bad variable reference.
2. No automated test may call a real Salesforce org unless I say so.
3. A task is DONE only when `tsc --noEmit`, ESLint and tests all pass.
   Report the actual results. Never say "done" if anything fails or was not run.

---

## 13. Working method
1. Work on ONE module per task. Do not touch other modules.
2. BEFORE coding: list the files you will create or change, then wait for my OK.
3. AFTER coding, give me:
   a) the request trace for each endpoint (route -> controller -> service -> model/adapter)
   b) a plain-English explanation of the logic, as if for a beginner
   c) exact Postman steps (method, URL, headers, sample body, expected response)
   d) results of tsc, ESLint and tests
   e) what you did NOT do
4. Keep `docs/postman/assertnow.postman_collection.json` updated for every endpoint added.
5. The old Deno/Hono code is a READ-ONLY reference. Do not copy it.
   Rewrite in this structure.

---

## 14. Task template
```
Task: <one thing, one module>
Phase: <current phase>
Read first: ARCHITECTURE.md, ENDPOINTS.md
Before coding: list the files you will create or change, then wait for my OK
Constraints: do not touch other modules, add no libraries or routes
After coding: request trace, plain-English logic, Postman steps,
              tsc/ESLint/test results, what was not done
```

---

## 15. Code readability rules (follow strictly)
The team lead reads every line of code before production.
Write code that a beginner can follow without help.

1. Use full, plain English names: `environmentId`, not `envId`.
2. One job per function. Keep each function short (under 30 lines).
3. No clever tricks. Use plain `if` and `for`. No nested ternaries,
   no long chains, no advanced TypeScript types.
4. Put a short comment at the top of every file saying what it is for.
   Comments explain WHY, in simple English.
5. Error messages use plain words: "Environment not found".
6. Return early when something is wrong. Avoid deep nesting.
7. No unused code and no "just in case" code.
8. After every task, explain your work in short, simple sentences,
   as if to a beginner.
