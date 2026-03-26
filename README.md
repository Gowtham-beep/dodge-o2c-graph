
# SAP Order-to-Cash Graph System

86 sales orders were delivered and never billed. That's **$43,919 in uncaptured revenue** sitting in the dataset, invisible until you ask the right question. This system finds it — and explains why it's a problem, not a metric to celebrate.

Built as a take-home assessment for Dodge AI's Forward Deployed Engineer role.

🔗 **Live demo:** https://dodge-o2c-graph.vercel.app/  
🔗 **GitHub:** https://github.com/Gowtham-beep/dodge-o2c-graph

---

## What It Does

Ingests a SAP Order-to-Cash JSONL dataset (20 tables), models it as a graph of interconnected business entities, and gives you two ways to explore it:

1. **Interactive graph** — 8 node types, 7 typed edges, zoom/pan/drag, hover tooltips, double-click node expansion
2. **Natural language chat** — ask a business question, get SQL generated, executed against PostgreSQL, and answered in plain English with the relevant graph nodes highlighted

---

## Architecture

### Full Data Flow

```
JSONL files (20 tables)
       │
       ▼
  seed.js ──► PostgreSQL on Aiven (source of truth)
                     │
           ┌─────────┼─────────┐
           │                   │
           ▼                   ▼
     GET /api/graph       POST /api/chat
           │                   │
    buildGraph.js         chat.js
    (8 parallel           │
     node queries    ┌────┴─────────────┐
     + 7 edge        │                  │
     queries,        ▼                  │
     FK-derived)  Pass 1: LLM           │
           │      SQL generation        │
           │         │                  │
           ▼         ▼                  │
    { nodes[], }  sanitizeSQL()         │
      edges[] }   + extractFirst-       │
           │        Statement()         │
           │         │                  │
           │         ▼                  │
           │    pg.query(sql)           │
           │         │                  │
           │         ▼                  │
           │    Pass 2: LLM             │
           │    result interpretation   │
           │    + product name JOIN     │
           │         │                  │
           │         ▼                  │
           │    buffer full answer      │
           │    → stripEntityIds()      │
           │    → extractEntityIds()    │
           │    → onToken(cleanAnswer)  │
           │         │                  │
           ▼         ▼                  │
      React Flow  ChatPanel          nodeIds[]
      (GraphView)  (streaming)     → highlight
                                    graph nodes
```

---

### Layer 1 — Data Ingestion (`seed.js`)

The seed script reads each JSONL file and bulk-inserts rows into PostgreSQL using `COPY FROM STDIN` with per-table schema definitions. Column names are preserved exactly as-is (camelCase SAP naming convention), which is why quoting becomes critical at query time. The schema enforces FK relationships that the graph layer later traverses.

---

### Layer 2 — Graph Construction (`buildGraph.js`)

Called on every `GET /api/graph` request. Runs **15 parallel SQL queries** — 8 for nodes, 7 for edges:

**Node queries** (each capped at 150 rows for UI performance):

| Node Type | Source | Label field |
|---|---|---|
| SalesOrder | `sales_order_headers` | `salesOrder` ID |
| BusinessPartner | `business_partners` | `businessPartnerName` |
| OutboundDelivery | `outbound_delivery_headers` | `deliveryDocument` ID |
| BillingDocument | `billing_document_headers` | `billingDocument` ID |
| JournalEntry | `journal_entry_items` | `accountingDocument` ID |
| Payment | `payments` | `accountingDocument` + `_PAY` suffix |
| Product | `products` JOIN `product_descriptions` | `productDescription` (EN) |
| Plant | `plants` | `plantName` |

Payment nodes use a composite key (`accountingDocument || '_PAY'`) to avoid ID collisions with JournalEntry nodes, which use the same `accountingDocument` field.

**Edge queries** (each capped at 300 rows):

| Edge | SQL pattern |
|---|---|
| SOLD_TO | `sales_order_headers.soldToParty → salesOrder` |
| DELIVERED_BY | `outbound_delivery_items.referenceSdDocument → deliveryDocument` |
| BILLED_AS | `billing_document_items.referenceSdDocument → billingDocument` |
| POSTED_TO | `billing_document_headers.billingDocument → accountingDocument` |
| CLEARED_BY | `payments.invoiceReference → accountingDocument_PAY` |
| CONTAINS | `sales_order_items.salesOrder → material` |
| SHIPPED_FROM | `outbound_delivery_items.deliveryDocument → plant` |

**Edge filtering:** After both sets are fetched, edges are filtered to only include rows where both `source` and `target` IDs exist in the node set. This prevents React Flow from rendering dangling edges that cause rendering errors.

---

### Layer 3 — Chat Pipeline (`chat.js`)

Two Groq API calls, one PostgreSQL query:

#### Pass 1 — SQL Generation

```
System prompt
  ├── Full schema (14 tables, all column names)
  ├── 6 explicit FK join patterns
  ├── Status code mappings (A/B/C)
  ├── 3 hardcoded broken-flow query templates
  ├── Domain guardrail instruction
  └── Strict response format: { "sql": "...", "answer": "..." }

+ Conversation history (last N messages, alternating roles,
  validated to satisfy Groq's strict role-alternation requirement)

→ LLM output: JSON with sql + answer fields
→ parseJSON(): strips markdown fences, extracts first {} block,
  falls back to plain-answer if unparseable
```

#### SQL Sanitization (between Pass 1 and execution)

```
sanitizeSQL()
  → regex: any camelCase word not already double-quoted
    gets wrapped in double quotes
  → prevents PostgreSQL lowercasing camelCase identifiers

extractFirstStatement()
  → split on semicolons, take first non-empty statement
  → prevents multi-statement injection
```

#### PostgreSQL Execution

```
pg.query(sanitizedSQL)
  → results (up to 50 rows)
  → product name enrichment:
      if any result row has a `material` field,
      JOIN product_descriptions to add `productName`
      (so Pass 2 sees names, not material codes)
```

#### Pass 2 — Result Interpretation

```
System prompt: "You are a business data analyst."

User message:
  ├── Business framing context
  │   (anomaly = risk, not performance; quantify exposure)
  ├── JSON.stringify(results, first 50 rows)
  └── Output instructions:
        use productName, include counts,
        no SQL/table mentions,
        append: ENTITY_IDS: [id1, id2, ...]

→ LLM output: buffered in full (not streamed token-by-token)

Post-processing:
  extractEntityIds() → finds ENTITY_IDS: [...] marker, parses IDs
  stripEntityIds()   → removes marker from display text
  extractNodeIds()   → scans all result rows for known ID fields
                       to catch IDs the LLM didn't explicitly list

→ onToken(cleanAnswer) — sends stripped answer to frontend
→ returns { sql, answer, results, nodeIds: union of both ID sets }
```

**Why buffer instead of true streaming?** The `ENTITY_IDS:` marker appears at the end of the LLM response. Stripping it requires seeing the full output first. Streaming token-by-token would require holding a buffer anyway, so the "streaming" effect is simulated by sending the clean answer as a single `onToken` call after processing.

---

### Layer 4 — Frontend (`GraphView.jsx` + `ChatPanel.jsx`)

**Graph rendering:**
- React Flow renders nodes with a custom `CustomNode` component (color-coded by type, hover tooltip with full metadata)
- Force-directed layout positions nodes on load; user can drag freely after
- On chat response, `nodeIds` from the API are matched against the graph node set — matching nodes get an amber glow style and their edges become animated dashed lines
- Double-click a node: graph filters to only that node + its direct neighbors, with edge labels shown

**Chat panel:**
- Each message rendered with a collapsible SQL block (the raw query used)
- Blinking cursor shown while `isStreaming` state is true
- History sent with each request (last 8 messages), SQL annotations stripped before sending

---

### Stack

| Layer | Technology | Reason |
|---|---|---|
| Backend | Fastify + Node.js | Lightweight, schema validation, fast startup |
| Database | PostgreSQL (Aiven) | Relational integrity, standard SQL for LLM generation |
| LLM | Groq LLaMA 3.3 70B | Free tier, fast inference, strong SQL generation |
| Frontend | React + Vite | Fast dev cycle, component model |
| Graph Viz | React Flow | Interactive nodes/edges, custom rendering, animated edges |
| Deployment | Render + Vercel | Free tier, zero-config CI/CD |

---

## Key Design Decisions

### PostgreSQL over Neo4j

The O2C dataset is fundamentally relational. Every meaningful relationship — SalesOrder → Delivery → BillingDocument → Payment — is already expressed as a foreign key. PostgreSQL handles these JOIN patterns efficiently, and crucially, the LLM generates reliable SQL. Cypher and Gremlin generation is significantly less mature in current models.

The graph is derived at query time from relational data, not stored separately. This avoids dual-write complexity with no meaningful performance tradeoff at this dataset size.

### Two-Pass LLM Architecture

**Pass 1:** System prompt with full schema, FK join patterns, status code mappings, and a strict `{ "sql": "...", "answer": "..." }` JSON format. The model generates SQL.

**Pass 2:** SQL executes against PostgreSQL. Results (capped at 50 rows) go back to the LLM with business-framing instructions: quantify financial exposure, use product names not material codes, flag anomalies as risks.

Separating generation from interpretation made a measurable difference in answer quality. Pass 1 stays mechanical; Pass 2 gets context it needs to reason.

---

## Challenges & How I Solved Them

### 1. PostgreSQL Case-Sensitivity Killed Every Query

SAP column names are camelCase — `soldToParty`, `referenceSdDocument`, `billingDocument`. PostgreSQL treats unquoted identifiers as lowercase. The LLM consistently generated `SELECT soldToParty` instead of `SELECT "soldToParty"`, causing runtime errors on every query.

**Solution:** Built `sanitizeSQL()` — a post-processor that runs before execution and wraps all known camelCase column names in double quotes. The system prompt also explicitly instructs the model to quote them, but the sanitizer is the safety net that actually made it reliable.

```js
// Before execution, fix what the LLM gets wrong
const CAMEL_COLUMNS = ['soldToParty', 'referenceSdDocument', 'billingDocument', ...];
function sanitizeSQL(sql) {
  return CAMEL_COLUMNS.reduce((s, col) =>
    s.replace(new RegExp(`(?<!")\\b${col}\\b(?!")`, 'g'), `"${col}"`), sql);
}
```

### 2. Broken Flow Detection Required Data Archaeology

The prompt needed to detect orders that were delivered but never billed. The obvious approach: check `overallOrdReltdBillgStatus = 'A'` (Not Started). Didn't work. Zero results.

Inspected the actual data. Unprocessed orders have an **empty string** for that field, not `'A'`. The status code mapping in the SAP documentation and the actual values in this dataset didn't match.

**Solution:** Hardcoded the correct detection pattern in the system prompt with an explicit comment explaining the discrepancy. Without inspecting the raw data, the query would have returned clean results and hidden $43,919 in billing gaps.

```sql
-- Correct: empty string means unprocessed, not 'A'
WHERE h."overallOrdReltdBillgStatus" = ''
  AND d."deliveryDocument" IS NOT NULL
```

### 3. The LLM Called a Revenue Crisis "Strong Performance"

First version of the system returned this answer for broken flow analysis:

> *"86 orders are in an advanced delivery stage with billing not yet initiated — this reflects strong operational performance in order fulfillment."*

The model was pattern-matching on "high count = good" without understanding the business context. 86 unprocessed billing documents is a revenue risk, not a success metric.

**Solution:** Added explicit framing instructions to the Pass 2 prompt:

```
Frame anomalies as business risks, not positive metrics.
"Orders delivered but not billed" = uncaptured revenue exposure.
Quantify the financial impact. Do not describe volume as performance.
```

The answer became: *"86 sales orders have been delivered but never billed, representing approximately $43,919 in uncaptured revenue."* Same data, completely different signal.

---

## Business Insights From the Dataset

Running the system against the actual O2C data:

- **$43,919 in uncaptured revenue** — 86 orders delivered, never billed
- **80 cancelled billing documents** — significant revenue reversal activity requiring investigation
- **Top products by billing volume:** FACESERUM 30ML VIT C and SUNSCREEN GEL SPF50-PA+++ 50ML (22 occurrences each)
- **0 orders** billed without a corresponding delivery — clean on that front

---

## Features

**Core:**
- ✅ Graph construction from 20 JSONL tables
- ✅ 8 node types, 7 typed edge relationships
- ✅ Interactive visualization (zoom, pan, drag, hover tooltips)
- ✅ NL → SQL → business answer pipeline
- ✅ Domain guardrails — tested and blocked: geography, math, current events, prompt injection

**Bonus:**
- ✅ Node highlighting — entities from responses highlighted with amber glow + animated edges
- ✅ Streaming LLM responses with blinking cursor
- ✅ Conversation memory — last 8 messages with SQL context
- ✅ Graph filtering by node type
- ✅ Node expansion — double-click shows direct neighbors only
- ✅ Resizable split panel
- ✅ Hide Granular Overlay toggle

---

## Guardrails

```
For ANY question unrelated to this dataset or SAP O2C domain,
respond ONLY with: { "sql": null, "answer": "This system is designed 
to answer questions related to the provided dataset only." }
```

Tested against: geography questions, creative writing, arithmetic, current events, identity questions, prompt injection attempts — all blocked.

---

## If I Had More Time

**Semantic search over entities** — right now you have to know what to ask. A vector index over node metadata would let the chat surface relevant entities before even running SQL.

**Smarter conversation memory** — the current approach sends last 8 messages verbatim. Pronoun resolution fails: "tell me more about it" after a product query often loses the referent. A proper context tracker that maintains entity state across turns would fix this.

**Prompt context bleed** — product ranking queries sometimes get interpreted through the broken flow lens because recent conversation history contains flow analysis. Classifying intent before choosing the prompt template would prevent this.

**Graph clustering** — the current force-directed layout works, but large subgraphs collapse visually. A proper clustering pass (Louvain or similar) would make the full graph readable.

---

## Running Locally

```bash
# Backend
cd backend && cp .env.example .env
# Set DATABASE_URL and GROQ_API_KEY
npm install && node src/db/seed.js && node src/index.js
# → http://localhost:3001

# Frontend
cd frontend && cp .env.example .env
# Set VITE_API_URL=http://localhost:3001
npm install && npm run dev
# → http://localhost:5173
```

---

## Project Structure

```
dodge-o2c-graph/
├── backend/src/
│   ├── index.js              # Fastify server
│   ├── db/schema.sql         # PostgreSQL schema
│   ├── db/seed.js            # JSONL ingestion
│   ├── graph/buildGraph.js   # Node/edge construction from FKs
│   ├── llm/chat.js           # Two-pass LLM + sanitizeSQL
│   └── routes/api.js         # REST endpoints
├── frontend/src/
│   ├── App.jsx               # Layout + state
│   └── components/
│       ├── GraphView.jsx     # React Flow visualization
│       ├── ChatPanel.jsx     # Chat interface + streaming
│       └── Legend.jsx        # Node type filter
├── ai-session-logs/
│   ├── claude-planning-session.md
│   └── gemini-ide-session.md
└── README.md
```

The `/ai-session-logs/` directory contains full session transcripts — architecture planning with Claude, implementation sessions in the Antigravity IDE. Included for transparency on process and iteration.

---

## Post-Submission Update: Resolving Context Bleed

*Note: I submitted the initial version of this project early. In the remaining time before the deadline, I identified and resolved an issue with query interpretation.*

### The Problem
Queries requesting simple product rankings (e.g., *"Which products have the most billing documents?"*) were being incorrectly framed in the final output. While the generated SQL was perfectly accurate, the final LLM synthesis interpreted the results through the lens of a process breakdown rather than a simple ranking.

### The Root Cause
The follow-up interpretation prompt (Pass 2) lacked awareness of the user's original intent. All queries were being funneled through the same rigid set of instructions, which were heavily biased toward anomaly detection and process gap analysis.

### The Fix: Zero-Shot Intent Classification
To eliminate this context bleed, I introduced a pre-processing step using a zero-shot intent classifier before the SQL generation phase. Queries are now categorized into one of five distinct intents:

- `PRODUCT_ANALYSIS`: Rank products by count, analyze demand insights.
- `FLOW_TRACE`: Trace specific documents through the O2C chain.
- `ANOMALY_DETECTION`: Flag process gaps and quantify revenue exposure.
- `ENTITY_LOOKUP`: Retrieve specific entity details.
- `GENERAL_ANALYSIS`: Default fallback for general O2C domain questions.

This intent classification is now passed to both Pass 1 (SQL Generation) and Pass 2 (Result Interpretation), ensuring the prompt instructions dynamically adapt to the specific type of query.

### The Result
Routing the queries through specific intent lenses completely eliminated the context bleed.

> **❌ Before (Context Bleed):** *"Critical process breakdown: 10 orders delivered but not billed."* (Incorrect framing for a ranking query).
>
> **✅ After (Intent-Aware):** *"FACESERUM 30ML VIT C and SUNSCREEN GEL SPF50-PA+++ 50ML lead with 22 billing documents each, indicating strong demand for skincare products."* (Accurate, contextually appropriate).
