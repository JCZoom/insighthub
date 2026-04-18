# API Reference

> All endpoints are under `/api/`. Authentication is required unless noted otherwise.

## Authentication

- **Dev mode** (`NEXT_PUBLIC_DEV_MODE=true`): All requests are automatically authenticated as the dev admin user.
- **Production**: Requests must include a valid NextAuth session cookie (JWT-based, Google OAuth).

---

## Health

### `GET /api/health` *(public)*

Health check endpoint for monitoring and load balancers.

**Response** `200 OK` (healthy) or `503 Service Unavailable` (degraded):
```json
{
  "status": "ok",
  "timestamp": "2026-04-18T16:32:53.889Z",
  "version": "0.1.0",
  "uptime": { "seconds": 3600, "since": "2026-04-18T15:32:53.889Z" },
  "database": { "status": "connected", "latencyMs": 10 },
  "ai": "configured",
  "memory": { "heapUsedMB": 36, "heapTotalMB": 65, "rssMB": 134 },
  "commit": "9cbcf71",
  "node": "v22.22.2"
}
```

---

## Dashboards

### `GET /api/dashboards`

List dashboards accessible by the current user.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | `""` | Search title, description, tags |
| `sort` | string | `"updatedAt"` | `"updatedAt"` or `"title"` |
| `limit` | number | `50` | Max results |
| `offset` | number | `0` | Pagination offset |

**Response** `200`:
```json
{
  "dashboards": [
    {
      "id": "clx...",
      "title": "Executive Summary",
      "description": "...",
      "tags": "revenue,kpi",
      "isPublic": false,
      "isTemplate": true,
      "createdAt": "2026-04-18T...",
      "updatedAt": "2026-04-18T...",
      "owner": { "id": "...", "name": "Jeff Coy", "email": "..." },
      "_count": { "versions": 3, "shares": 2 }
    }
  ],
  "total": 12
}
```

### `POST /api/dashboards`

Create a new dashboard. Requires `CREATOR`, `POWER_USER`, or `ADMIN` role.

**Body:**
```json
{
  "title": "My Dashboard",
  "description": "Optional description",
  "tags": ["revenue", "monthly"],
  "schema": { ... },
  "isPublic": false
}
```

All fields are optional. Defaults: title = "Untitled Dashboard", schema = empty dashboard.

**Response** `201`:
```json
{
  "dashboard": {
    "id": "clx...",
    "title": "My Dashboard",
    "versions": [{ "version": 1, "changeNote": "Initial version" }]
  }
}
```

### `GET /api/dashboards/:id`

Get a single dashboard with its latest version.

**Response** `200` or `404`.

### `PUT /api/dashboards/:id`

Update dashboard metadata and/or schema.

### `DELETE /api/dashboards/:id`

Soft-delete (archive) a dashboard.

### `POST /api/dashboards/:id/duplicate`

Create a copy of the dashboard.

### `GET /api/dashboards/:id/versions`

List all versions of a dashboard.

### `POST /api/dashboards/:id/revert/:versionId`

Revert a dashboard to a specific version.

### `GET /api/dashboards/:id/share`

List share permissions for a dashboard.

### `POST /api/dashboards/:id/share`

Share a dashboard with a user.

---

## Chat (AI)

### `POST /api/chat`

Send a message to Claude AI to build or modify a dashboard.

**Body:**
```json
{
  "message": "Add a KPI card showing monthly revenue",
  "dashboardId": "clx...",
  "schema": { ... },
  "conversationHistory": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response** `200`:
```json
{
  "message": "I've added a Monthly Revenue KPI card...",
  "patches": [
    {
      "op": "add_widget",
      "widget": { "id": "w_...", "type": "kpi", ... }
    }
  ]
}
```

**Patch operations:** `add_widget`, `update_widget`, `remove_widget`, `use_widget`

---

## Glossary

### `GET /api/glossary`

List all glossary terms.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `source` | string | `"yaml"` | `"yaml"` or `"db"` |

**Response** `200`:
```json
{
  "terms": [
    {
      "term": "Monthly Recurring Revenue",
      "definition": "...",
      "category": "Revenue",
      "formula": "SUM(active_subscriptions.monthly_amount)"
    }
  ],
  "source": "yaml"
}
```

### `POST /api/glossary`

Create a new glossary term. Requires `ADMIN` role.

**Body:**
```json
{
  "term": "Net Revenue Retention",
  "definition": "Revenue retained from existing customers...",
  "category": "Revenue",
  "formula": "...",
  "relatedTerms": ["MRR", "Churn Rate"]
}
```

### `GET /api/glossary/search`

Search glossary terms.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search term, definition, category |
| `category` | string | Filter by exact category |

### `GET /api/glossary/:id`

Get a single glossary term.

### `PUT /api/glossary/:id`

Update a glossary term. Requires `ADMIN` role.

### `DELETE /api/glossary/:id`

Delete a glossary term. Requires `ADMIN` role.

---

## Widgets

### `GET /api/widgets`

Search the widget library.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search query |
| `type` | string | Filter by widget type (e.g. `kpi`, `bar`, `line`) |
| `limit` | number | Max results (default 20) |

### `POST /api/widgets/fork`

Clone a widget template with a fresh ID.

**Body:**
```json
{ "templateId": "widget_revenue_kpi" }
```

### `POST /api/widgets/publish`

Publish a widget to the company library (Phase 2).

---

## Data

### `POST /api/data/query`

Execute a query against sample data sources.

**Body:**
```json
{
  "source": "sample_customers",
  "aggregation": "count",
  "groupBy": "region",
  "filters": { "plan": "enterprise" }
}
```

---

## Admin

### `GET /api/admin/audit`

List audit log entries. Requires `ADMIN` role.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `userId` | string | Filter by user |
| `action` | string | Filter by action type |
| `resourceType` | string | Filter by resource |
| `limit` | number | Max results |
| `offset` | number | Pagination offset |

---

## Error Responses

All endpoints return errors in this shape:

```json
{
  "error": "Human-readable error message",
  "code": "OPTIONAL_ERROR_CODE"
}
```

**Common status codes:**
| Code | Meaning |
|------|---------|
| `400` | Bad request / validation error |
| `401` | Not authenticated |
| `403` | Insufficient permissions |
| `404` | Resource not found |
| `429` | Rate limit exceeded (includes `Retry-After` header) |
| `500` | Internal server error |

## Rate Limiting

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1713456789000
```

When rate limited (`429`), a `Retry-After` header specifies seconds to wait.

**Default limits:**
- Dashboard endpoints: 60 requests/minute
- Chat (AI) endpoint: 30 requests/minute
