# Test Coverage Analysis

## Current State

The codebase has **effectively zero automated test coverage**. There is no test framework installed, no test runner configured, and no `test` script in `package.json`. The three existing files with "test" in their name are informal, manually-run scripts — not automated tests:

| File | What it does |
|------|-------------|
| `src/tests/test-ai-parsing.js` | Manually runs 2 hardcoded scenarios for AI JSON parsing |
| `test_ai.ts` | Manually triggers the `processProposalWithAIAction` with a hardcoded proposal ID |
| `test_pptx_gen_2.js` / `test_pptx_gen_3.js` | Manually verifies PPTX XML slide injection |

None of these are integrated into the development workflow. There is no CI check, no coverage report, and no way to run them with `npm test`.

---

## High-Priority Areas for Improvement

The following areas carry the most risk and would benefit most from tests, ordered by impact.

---

### 1. Price Calculation Logic (`src/actions/proposal.ts`, `src/tests/test-ai-parsing.js`)

**Why it matters:** This logic determines how much customers are charged. A bug here has direct financial impact.

**The logic exists in two places (code duplication):**
- `src/actions/proposal.ts:247–261` — applied after every AI response
- `src/tests/test-ai-parsing.js:40–54` — copy-pasted into the manual test

**What to test:**
- Area calculation: `width × height`
- Minimum price enforcement: result must be `max(area × 28, 80)`
- Comma-to-dot normalization for decimal inputs (e.g. `"2,50"` → `2.5`)
- Zero-dimension items (width or height = 0, area = 0 → price must be 80, the minimum)
- Very large items where calculated price exceeds the minimum
- `price_rule` label: `'Minimo'` vs `'Calculado'`
- Total aggregation: `result.total = sum of item prices`

**Suggested test cases:**
```
width=5.25, height=1.32  → area=6.93, price=194.04,  rule='Calculado'
width=1.0,  height=1.0   → area=1.0,  price=80.00,   rule='Minimo'
width=0,    height=2.0   → area=0,    price=80.00,   rule='Minimo'
width="2,50", height="1,00" → area=2.5, price=80.00, rule='Minimo'
```

---

### 2. AI Response Parsing (`src/actions/proposal.ts:207–261`)

**Why it matters:** The app depends entirely on GPT-4o returning parseable JSON. When it doesn't, the whole proposal workflow breaks. There are two distinct response formats to handle.

**What to test:**
- Plain JSON string → parsed correctly
- JSON wrapped in ` ```json ... ``` ` markdown block → stripped and parsed
- `components` format (newer prompts) → mapped to `items` with correct field names (`face` → `name`, `dimensions.width_or_depth` → `width`, `dimensions.height` → `height`)
- `items` format (older prompts) → used as-is
- Missing `items` and missing `components` → should throw/return a clear error
- Empty `items` array → handled without crashing
- Malformed JSON → graceful error (not unhandled exception)
- `comp.face` missing, falling back to `comp.name`, then `"Elemento"`

---

### 3. Proposal Service — Database Operations (`src/services/proposal.ts`)

**Why it matters:** These functions are the data layer for the entire app. Errors here silently corrupt data (e.g. `deleteProposal` deletes child records in sequence — if the first delete fails, the parent may still be deleted).

**What to test (with a mocked Supabase client):**
- `createProposal` — inserts correct fields, throws on DB error
- `getProposals` — applies `userId` filter only when provided
- `getProposalById` — throws when not found
- `getLatestAIProcessing` — returns `null` when no processing exists (error code `PGRST116`), throws on other errors
- `deleteProposal` — deletes in correct order (items → AI records → proposal)
- `saveAIProcessing` — inserts AI record, clears old items, inserts new ones, appends to `prompts` array
- `saveProposalItems` — handles both `item.name`/`item.width` (frontend) and `item.nome_ambiente`/`item.largura` (DB) field names

---

### 4. Server Actions (`src/actions/proposal.ts`)

**Why it matters:** These are the entry points for all user-triggered operations. They wrap service calls with error handling, but the error paths are untested.

**What to test:**
- `createProposalAction` — returns `{ success: true, id }` on success; `{ success: false, error }` when service throws
- `confirmProposalAction` — upserts client when `whatsapp` is present; skips upsert when `whatsapp` is absent
- `processProposalWithAIAction` — uses DB system prompt when available; falls back to hardcoded `SYSTEM_PROMPT`; skips image when `instruction === 'confirmed_items'`
- `deleteProposalAction` — returns success/failure correctly

---

### 5. API Route (`src/app/api/ai/process/route.ts`)

**Why it matters:** This is the only public HTTP endpoint. It should validate inputs and return appropriate HTTP status codes.

**What to test:**
- Valid POST request → 200 with result
- Missing required fields → 400 with error message
- OpenAI API failure → 500 with error message
- Malformed request body → handled without crashing

---

### 6. PPTX Generation (`src/services/pptxGenerator.ts`)

**Why it matters:** The PPTX output is a customer-facing deliverable. Silent failures (wrong slide content, missing items) are hard to catch manually.

**What to test:**
- Slide 4 text injection: items appear in correct positions
- Item count: correct number of rows in the table
- Mockup ASCII art is injected into the correct XML placeholder
- Output is a valid ZIP/PPTX buffer (can be opened by jszip)
- Items with special characters in names don't break XML

---

### 7. PDF Generation (`src/services/pdfGenerator.ts`)

**Why it matters:** PDF is the main customer document. Layout bugs (text overflow, missing items) are hard to detect without visual inspection.

**What to test (with a mocked jsPDF):**
- All items appear in the generated table
- Total price is included
- Client name and city appear on the correct page
- Items beyond a certain count don't overflow the page layout
- `price_rule` formatting: `'Minimo'` and `'Calculado'` labels render correctly

---

### 8. Translation Action (`src/actions/translate.ts`)

**Why it matters:** Small but frequently used. If OpenAI call fails, the error should be handled gracefully.

**What to test:**
- Successful translation returns translated text
- OpenAI error returns `{ success: false, error }`
- Empty input is handled

---

## Recommended Setup

Since no framework exists yet, here is the minimum recommended setup:

### Install Vitest (preferred for Next.js/TypeScript projects)

```bash
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
```

Add to `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

Add `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',  // use 'jsdom' for component tests
    globals: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### Where to put tests

```
src/
  __tests__/
    pricing.test.ts          # Price calculation logic
    ai-parsing.test.ts       # AI response parsing
    services/
      proposal.test.ts       # DB service layer (with mocked Supabase)
    actions/
      proposal.test.ts       # Server actions (with mocked services)
    api/
      ai-process.test.ts     # API route handler
```

### Mocking Supabase

The Supabase client is created server-side via `createClient()`. For unit tests, mock the module:

```ts
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProposal, error: null }),
    })),
  })),
}))
```

---

## Coverage Targets (Suggested)

| Area | Priority | Suggested Coverage Goal |
|------|----------|------------------------|
| Price calculation logic | Critical | 100% |
| AI response parsing | Critical | 100% |
| Proposal service (DB layer) | High | 80% |
| Server actions | High | 70% |
| API routes | High | 80% |
| PPTX generation | Medium | 60% |
| PDF generation | Medium | 50% |
| Translation action | Low | 70% |

---

## Quick Wins (Start Here)

The fastest way to get meaningful coverage with least setup effort:

1. **Extract the pricing + parsing logic** from `src/actions/proposal.ts` into a pure utility function in `src/lib/pricing.ts`. Pure functions with no side effects are trivial to test.

2. **Write tests for that utility first** — it covers the two highest-risk bugs (wrong price, wrong data parsing) and requires no mocking.

3. **Add Vitest** and wire up the `test` script so tests run in CI.

4. **Mock Supabase once** and test the service layer functions — they are already well-structured for unit testing.
