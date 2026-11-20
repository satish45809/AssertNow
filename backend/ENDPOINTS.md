# ENDPOINTS.md

The agent may create ONLY the routes under "APPROVED". Everything under
"PLANNED" is not allowed yet. A route moves to APPROVED only when I start that module.

Base path: `/api/v1` (except `/health`)

---

## Conventions (apply to every endpoint)

**Response shape**
- Success: `{ "success": true, "data": ... }`
- Error: `{ "success": false, "error": { "code": "...", "message": "..." } }`

**Status codes**
| Code | Use |
|---|---|
| 200 | get, update, list |
| 201 | create |
| 202 | workflow run accepted (execution is QUEUED) |
| 204 | delete (no body) |
| 400 | validation failed |
| 404 | not found (never return a different item instead) |
| 409 | conflict (e.g. deleting an environment that is in use) |
| 502 | Salesforce or connection error |

**Pagination** (all list routes): `?page=1&limit=20` (max limit 100).
Response: `{ "success": true, "data": [...], "page": 1, "limit": 20, "total": 57 }`

**Secrets**
- Secret fields are never returned in any response (omit them, do not mask).
- On update, an omitted secret field means "keep the current value".

**Other**
- Fixed paths (e.g. `/environments/oauth/...`) are declared before `/:id` paths.
- 404 handler and error handler are middleware, not routes.
- `PATCH` is used for environments (partial update). `PUT` is used for workflows
  (the whole graph is replaced). This is intentional.

---

## APPROVED (build now)

| Method | Path | Purpose |
|---|---|---|
| GET | /health | Server health check (outside /api/v1) |

---

## PLANNED (do NOT build yet)

### Environments (Phase 4, module 1)
| Method | Path | Purpose |
|---|---|---|
| GET | /environments | List environments |
| POST | /environments | Create environment (secrets encrypted) |
| GET | /environments/:id | Get one environment |
| PATCH | /environments/:id | Partial update |
| DELETE | /environments/:id | Delete. Returns 409 if any workflow or running execution references it |
| POST | /environments/:id/test-connection | Get a token and verify with Salesforce |
| GET | /environments/:id/oauth/authorize-url | Returns the Salesforce login URL (backend creates and stores `state` and PKCE verifier) |
| POST | /environments/:id/oauth/exchange | Body `{ code, state }`. Backend checks `state`, exchanges the code, stores the encrypted refresh token |
| GET | /environments/:id/limits | Salesforce API usage / remaining limits |

Create body depends on `authMethod` (use a zod discriminated union):
- `CLIENT_CREDENTIALS`: requires `loginUrl` (My Domain), `clientId`, `clientSecret`
- `JWT`: requires `loginUrl`, `clientId`, `username`, `privateKey`
- `REFRESH_TOKEN`: requires `loginUrl`, `clientId` (and `clientSecret` if the connected app needs it);
  the refresh token itself arrives through the OAuth routes above, never in the create body

Every environment has `tier` and `allowWrites` (default `false`).

### Workflows (Phase 4, module 2)
| Method | Path | Purpose |
|---|---|---|
| GET | /workflows | List workflows (filter: `platform`) |
| POST | /workflows | Create workflow |
| GET | /workflows/:id | Get one workflow |
| PUT | /workflows/:id | Replace workflow (graph) |
| DELETE | /workflows/:id | Delete workflow |
| POST | /workflows/:id/validate | Check the graph (one start node, no orphans, variables exist) without running |

### Executions (Phase 4, module 3; worker in Phase 5)
| Method | Path | Purpose |
|---|---|---|
| POST | /workflows/:id/executions | Run a workflow. Returns 202 with the execution (status QUEUED) |
| GET | /executions | List executions. Allowed filters: `workflowId`, `status`, `environmentId` |
| GET | /executions/:id | One execution with step results |
| POST | /executions/:id/cancel | Cancel a queued or running execution |
| GET | /executions/:id/stream | Live logs (SSE) |

Run rules for `POST /workflows/:id/executions`:
- Body may contain `environmentId` and `variables`.
- Environment used = body `environmentId`, else the workflow's saved `environmentId`.
- If neither exists: 400. NEVER fall back to any other environment.
- The workflow is validated before queuing. An invalid graph returns 400.

SSE note: browser `EventSource` cannot send an Authorization header. Revisit when
real authentication is added (Phase 6).

### Metadata (Phase 4, module 4)
| Method | Path | Purpose |
|---|---|---|
| GET | /environments/:id/metadata/objects | List objects |
| GET | /environments/:id/metadata/objects/:name | Fields of one object |
| GET | /environments/:id/metadata/objects/:name/fields/:field/picklist | Picklist values. Dependent picklists: `?controllingValue=` |
| POST | /environments/:id/metadata/sync | Re-discover and cache the org schema |

### Reports (Phase 4, module 5)
| Method | Path | Purpose |
|---|---|---|
| GET | /reports/overview | Pass/fail stats, fleet health, API quota summary for the Overview page |

---

## DEV ONLY (learning/Postman, delete before production)
None approved yet. Any temporary route goes here first, lives in
`routes/dev.routes.ts`, and is mounted only when `NODE_ENV === 'development'`.
Dev routes obey the `allowWrites` and production-tier guardrails.

Examples I may approve later:
- POST /dev/environments/:id/sobjects/:sobject (create a record)
- GET /dev/environments/:id/sobjects/:sobject/:recordId (read a record)
- DELETE /dev/environments/:id/sobjects/:sobject/:recordId (delete a record)

To test Salesforce operations without dev routes, run a one-node workflow
through `POST /workflows/:id/executions`.

---

## NOT ALLOWED (removed from the old backend)
- `/verify` and `/connect` duplicates
- `environments/sync` (overwrite everything from the frontend)
- `test-query` using a default environment
- Raw record CRUD in production routes (use workflow nodes instead)
- Any route not listed in this file
