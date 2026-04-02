# Action Plan

Each section maps directly to a README todo. Files are referenced by path so you can jump straight to the relevant code.

---

## Standing Rule — i18n

**Any string rendered in the UI must use `t('key')` via `useI18n()` — never hardcode text in templates.**

The project has four locale files:
- `app/locales/en.json`
- `app/locales/nl.json`
- `app/locales/ro.json`
- `app/locales/pl.json`

For every piece of new UI text introduced by any item below:
1. Add the key and English value to `en.json`.
2. Add the same key with translated values to `nl.json`, `ro.json`, and `pl.json`.
3. Reference the key in the template with `{{ t('your.key') }}` or `:placeholder="t('your.key')"` etc.

---

## 1. Delete a Visit

**What:** Add a delete endpoint that removes a visit and all associated records in the correct dependency order.

**Steps:**

1. Create `server/api/visits/[id].delete.ts`:
   - Call `requireUser` and verify the visit belongs to the user (`visits.userId = user.id`)
   - Delete in this order to avoid FK violations:
     1. `parsedDocuments` where `visitId = id`
     2. `jobParts` via `jobVisits` that belong to this visit's `licensePlate`
     3. `jobVisits` where `licensePlateId` matches any `licensePlates` linked to this visit
     4. `charges` where `visitId = id`
     5. `invoices` where `visitId = id`
     6. `licensePlates` where `visitId = id`
     7. `visits` where `id = id`
   - Return `{ ok: true }`

2. In `app/pages/visits/[id]/index.vue` (line ~315), add a delete button in the action buttons block (only visible when `!isLocked`):
   - On click: confirm dialog → call `DELETE /api/visits/${visitId}` → navigate to `/`

---

## 2. Delete Account

**What:** Let a user permanently delete their account and all data tied to it.

**Steps:**

1. Create `server/api/auth/account.delete.ts`:
   - Call `requireUser`
   - Create a restore point in the database. If any further operations fail, restore the DB to this point.
   - Get all `visits.id` for this user
   - Delete in order per visit (same cascade as #1 above, for each visit)
   - Delete `passwordReset` rows where `userId = user.id`
   - Nullify `users.garageId` then delete the `garages` row if the garage belongs only to this user (or skip if shared)
   - Delete all associated invoices, charges, parsedDocuments
   - Delete the `users` row
   - Call `clearUserSession(event)`
   - Return `{ ok: true }`

2. In `app/pages/settings/index.vue`, add a "Danger Zone" section at the bottom:
   - Red-bordered card with a warning message
   - "Delete Account" button that opens a confirmation modal requiring the user to type their email before proceeding
   - On confirm: `DELETE /api/auth/account` → redirect to `/login`

---

## 3. Customer Search Scoped to Current User

**What:** `GET /api/customers` currently searches all customers in the database. It must only return customers who appeared in a visit owned by the current user.

**File:** `server/api/customers/index.get.ts`

**Steps:**

1. Import `visits` from schema and `inArray`, `sql` from drizzle-orm.
2. First query: fetch distinct `customerId` values from `visits` where `userId = user.id`.
3. Build customer search conditions as before (`ilike(customers.name, ...)`), but add `inArray(customers.id, allowedCustomerIds)` to the `where` clause.
4. If `allowedCustomerIds` is empty, return `[]` immediately (no previous customers).

```ts
// Rough outline
const allowed = await db
  .selectDistinct({ id: visits.customerId })
  .from(visits)
  .where(and(eq(visits.userId, user.id), isNotNull(visits.customerId)))
const ids = allowed.map(r => r.id).filter(Boolean) as number[]
if (!ids.length) return []
// then use inArray(customers.id, ids) in existing query
```

---

## 4. Trial Login Redirect Bug

**What:** After a successful login, the user is not redirected to `/`.

**Files:** `app/pages/login.vue`, `app/middleware/auth.global.ts`

**Steps:**

1. Read `app/pages/login.vue` — confirm whether `navigateTo('/')` is called after the login `$fetch` resolves.
2. The middleware (`auth.global.ts:9`) calls `navigateTo('/login')` for non-logged-in users, but this fires before the session cookie is set client-side.
3. Fix: in `app/pages/login.vue`, after the login POST returns `{ ok: true }`, call `await refreshNuxtData()` then `navigateTo('/')` explicitly instead of relying on the middleware reacting to the updated session.
4. For the trial flow: after `POST /api/subscribe/trial` sets `subscriptionType: 'trial'` in the session, the subscribe page should call `navigateTo('/')`. Verify this is wired up in `app/pages/subscribe/index.vue`.

---

## 5. Fluids / Reference Search — Multi-Word Queries

**What:** Searching "brake" returns "brake fluid" but "brake fluid" (two words) returns nothing because the `ilike` wraps the whole string including the space.

**Files:** `server/api/reference/fluids.get.ts`, `server/api/reference/labor-times.get.ts`, `server/api/reference/car-templates.get.ts`

**Steps:**

1. In `fluids.get.ts` (line ~21), split the search string by whitespace and build an `and(...)` of `or(ilike(col1, term), ilike(col2, term), ...)` for each token:
```ts
const terms = (query.search as string).trim().split(/\s+/)
const termConditions = terms.map(term => {
  const s = `%${term}%`
  return or(ilike(fluids.systemName, s), ilike(fluids.type, s), ilike(fluids.spec, s))
})
conditions.push(and(...termConditions))
```
2. Apply the same pattern to `labor-times.get.ts` and `car-templates.get.ts` wherever `ilike` search is used.

---

## 6. Search Query Not Cleared When Entering a Submenu

**What:** In fluids and DTC screens, the search bar text carries over when navigating into a sub-view (e.g. selecting a car template).

**Files:** `app/pages/fluids/index.vue` (line ~38), `app/pages/dtc/index.vue` (line ~84)

**Steps:**

1. In `fluids/index.vue`, on the template select `@click` handler, add `search.value = ''` before setting `selectedTemplate`.
2. In `dtc/index.vue`, the "All Codes" button and template select both navigate into the code list. Clear `search.value = ''` in each `@click` that sets `selectedTemplate`. The back button already does `search = ''` (line 84) — verify it resets correctly.

---

## 7. DTC Page — Detail View Missing Fields + No Initial Results

**What:** (a) The detail card for a DTC code only shows `code` and `categoryName`. The DB has `subcategory`, `shortDescription`, `description`, `symptoms`, `commonCauses`, `diagnosticSteps`, `repairNotes`, `severity`, and `isGeneric` — none of which are displayed. (b) Without a car or search term, the code list shows nothing.

**Files:** `server/api/reference/dtc.get.ts` (line ~30), `app/pages/dtc/index.vue` (line ~29)

**Steps:**

**(a) Fix missing detail fields:**

The list endpoint explicitly selects only 6 fields (line ~31–37 of `dtc.get.ts`). When `selectedCode` is set on click, it only has those 6 fields — so all the `v-if="selectedCode.description"`, `v-if="selectedCode.symptoms?.length"` etc. blocks in the detail view (lines ~41–56 of `dtc/index.vue`) are always falsy.

Two options:

Option A — Fetch full detail on click (preferred, keeps list payload small):
1. Create `server/api/reference/dtc/[id].get.ts` that returns the complete `dtcCodes` row by `id`.
2. In `dtc/index.vue`, change the code list `@click` to an async handler that fetches the full record before setting `selectedCode`:
```ts
async function selectCode(code: any) {
  const full = await $fetch(`/api/reference/dtc/${code.id}`)
  selectedCode.value = full
}
```

Option B — Return all fields in the list endpoint:
1. Remove the explicit `db.select({ id, code, ... })` projection in `dtc.get.ts` and replace with `db.select().from(dtcCodes)...` so all columns are returned.
2. No frontend changes needed — the existing detail template already references all the right field names.

**(b) Show some codes without a car selected:**

In `dtc.get.ts` (line ~29), when no `search` and no `templateId`, the endpoint returns `[]` immediately. Change the fallback to return a starting set of generic codes ordered by severity:
```ts
if (!query.search && !query.templateId) {
  return db.select({ id: dtcCodes.id, code: dtcCodes.code, categoryName: dtcCodes.categoryName, shortDescription: dtcCodes.shortDescription, severity: dtcCodes.severity })
    .from(dtcCodes)
    .where(eq(dtcCodes.isGeneric, true))
    .limit(50)
}
```

---

## 8. Edit Customers

**What:** There is no way to edit a customer's name, email, or phone number after creation.

**Steps:**

1. Create `server/api/customers/[id].patch.ts`:
   - `requireUser` — then verify customer appears in at least one visit for this user (same scope check as #3)
   - Accept `{ name?, email?, phoneNo? }` from body
   - `db.update(customers).set({ ... }).where(eq(customers.id, id)).returning()`

2. In `app/pages/visits/[id]/index.vue`, add an edit icon (pencil) next to the customer name (line ~87) that opens a modal.

3. Reuse `app/components/visits/CustomerForm.vue` or create a separate edit form component — pre-fill with existing customer data, `PATCH` on submit, call `refresh()` after.

---

## 9. Duplicate Parts — Graceful Handling

**What:** Adding a part with the same name and brand throws a unique constraint DB error with no user-friendly message. Re-using existing parts also fails.

**Files:** `server/api/parts/index.post.ts`, `server/api/parts/link.post.ts`

**Steps:**

1. In `parts/index.post.ts`, before inserting, check for an existing part:
```ts
const [existing] = await db.select().from(parts)
  .where(and(ilike(parts.name, name), ilike(parts.brand, brand || ''))).limit(1)
if (existing) {
  throw createError({ statusCode: 409, message: 'A part with this name and brand already exists. Use the existing part and adjust the price instead.' })
}
```

2. In the frontend (`app/components/parts/AddOptions.vue` or wherever the add-part form is), catch `statusCode === 409` and display the message prominently, with a button to find the existing part.

3. In `server/api/parts/link.post.ts`, when linking a part that already exists in `jobParts`, use an upsert or skip duplicate insertion:
```ts
// Use onConflictDoNothing() or check before inserting
```

---

## 10. Job State Not Cleared When Linking a Customer

**What:** When a customer is linked to a job, the job shows parts/labor copied from a previous visit (state not cleared).

**Files:** `server/api/visits/[id]/jobs.post.ts`, frontend job/part state

**Steps:**

1. Read `server/api/visits/[id]/jobs.post.ts` to verify whether it copies `jobParts` from prior visits when creating a `jobVisit`.
2. If the copy is happening server-side: remove any logic that propagates parts from previous `jobVisit` entries.
3. If it is a frontend state issue: in `app/components/visits/JobSelector.vue` (or the visit page), ensure the `visitParts` list is re-fetched fresh after linking a customer and after adding a job. The `refresh()` call on `saved` event (visit page line ~344) should cover this — confirm the `/api/visits/[id]` GET response does not bleed data from other visits.

---

## 11. Visit Not Persistent Until Details Added

**What:** `POST /api/visits` (line ~8) creates a DB record immediately when "Start Job" is clicked, even if the user adds nothing and navigates away — leaving empty ghost visits.

**File:** `server/api/visits/index.post.ts`, `app/pages/index.vue`

**Steps:**

Option A (preferred — deferred creation):
1. On the frontend, generate a temporary "draft visit" in local state (no DB call yet).
2. Only call `POST /api/visits` when the first meaningful piece of data is saved (customer linked, car looked up, job added).
3. Pass the pending data in the initial POST body so the first write is complete.

Option B (simpler — cleanup job):
1. When leaving a job without any details added to it (no charges, no jobs, no parts, no customer, no car) send a delete request to the backend to delete the visit
  - Add explicit and strict checks to not delete jobs which are populated.

---

## 12. Capitalize License Plate Input

**What:** The plate input has CSS `uppercase` but `plate.value` is sent as-is (lowercase) to the API.

**File:** `app/components/visits/CarLookup.vue` (line ~108)

**Steps:**

1. Add an `@input` handler on the `UInput` for plate:
```html
<UInput v-model="plate" @input="plate = plate.toUpperCase()" ... />
```
Or use a computed setter if `UInput` doesn't fire `@input` on `v-model`.

2. In `server/api/cars/lookup.post.ts`, also normalize the plate to uppercase server-side as a defensive measure.

---

## 13. Add Labor — Empty Results on Open

**What:** Opening the Job Selector modal shows no results because `jobs-available` requires a search term or matched car template.

**File:** `server/api/visits/[id]/jobs-available.get.ts`

**Steps:**

1. Read `jobs-available.get.ts` — check if it returns empty when `search` is blank and a car template is linked.
2. If the endpoint requires a non-empty search: change the default behavior to return all jobs for the linked car template when `search` is empty (up to a reasonable limit like 100).
3. If no car template is linked: show an instructional message in the modal (this already exists in `JobSelector.vue` line ~41).
4. When the user searches jobs, and there is a car linked, make sure that only jobs linked to the car template are returned to limit duplicate job examples.
---

## 14. Charges — Quantifiable Toggle

**What:** Charges don't support a quantity multiplier. The README notes "charges are not serializable" and requests a toggle for quantifiable charges.

**Schema:** `charges` table in `server/db/schema.ts` (line ~232) — no `quantity` or `isQuantifiable` column.

**Steps:**

1. **Schema change (coordinate with user — no migrations without approval):** Add `quantity integer default 1` and `isQuantifiable boolean default false` to the `charges` table.

2. In `server/api/visits/[id]/charges.post.ts`, accept `quantity` and `isQuantifiable` in the body and insert them.

3. In `app/components/visits/ChargeSelector.vue`, add a toggle "Fixed / Per Unit" and a quantity input (shown when "Per Unit" is selected).

4. In the visit detail page totals calculation (`app/pages/visits/[id]/index.vue` line ~43), update `chargesTotal` to multiply `price * quantity` when `isQuantifiable` is true.

---

## 16. Payment Link — Copy / Share After Invoice Generation

**What:** After generating an invoice with a Stripe payment link, the user needs an easy way to copy or share it.

**File:** `app/pages/visits/[id]/index.vue` (line ~288)

**Steps:**

1. Next to the "Payment Link" button (line ~289), add a copy icon button:
```ts
async function copyPaymentLink() {
  await navigator.clipboard.writeText(invoice.value.stripePaymentLink)
  // show a toast confirming copy
}
```
2. Optionally, if `navigator.share` is available (mobile), add a share button that calls `navigator.share({ url: invoice.value.stripePaymentLink })`.

---

## 17. Back Button Loop (0 → -1 → 0 → -1)

**What:** Pressing back from a visit page causes an infinite loop between routes.

**Root cause:** `POST /api/visits` is called on "Start Job" — this navigates to `/visits/:id`. Pressing back goes to the page that created the visit, which immediately creates a new visit and navigates forward again.

**File:** `app/pages/index.vue` (the "Start Job" button handler)

**Steps:**

1. Use `router.replace('/visits/:id')` instead of `router.push(...)` when navigating to a new visit, so pressing back skips the creation page entirely.
2. Alternatively, implement the deferred visit creation from #11 — if no visit is created until real data is added, there is nothing to loop back to.

---

## 18. Session Not Cleared Between Accounts (NL → UK Region Bleed)

**What:** After logging out of an NL account and logging into a UK account, the NL suggestions persist because the old `billingCountry` stays in the Nuxt session or component state.

**Files:** `server/api/auth/logout.post.ts`, `app/components/visits/CarLookup.vue` (line ~9)

**Steps:**

1. Read `server/api/auth/logout.post.ts` — confirm it calls `clearUserSession(event)`. If not, add it.
2. In `CarLookup.vue`, `country` is initialized from `user.value?.billingCountry` once when the component mounts. This is fine as long as the session user is fresh after login. Verify that after login, `useUserSession()` returns the new user's data (not the previous user's). If `user.value` still reflects the old session, the login endpoint may need to fully replace the session object.
3. In `server/api/auth/login.post.ts` (line ~21), confirm all session fields are set fresh — `billingCountry` must come from the newly authenticated user, not merged with any prior session.

---

## 19. UK Car Lookup — Wrong Engine Size / Template Range Match

**What:** The DVLA API always returns `engineCapacity` in cc. The code converts cc → L and then queries `carTemplates` for a ±0.1L range, but the range filter is broken — it only applies an upper bound and no lower bound, so a 999cc (1.0L) engine matches templates up to 1.1L but also matches every template below 1.0L down to 0L. Additionally `engineSize` in `carTemplates` is stored as a `varchar` (e.g. `"1.4L"`), so Drizzle's `lte`/`gte` do lexicographic string comparison, not numeric comparison.

**File:** `server/api/cars/lookup.post.ts` (lines 90–101)

**Exact bug:**

```ts
// line 90 — cc to L conversion (this part is correct)
const engineL = engineCc > 0 ? Math.round(engineCc / 100) / 10 : null

// lines 94–100 — only lte (upper bound), no gte (lower bound)
templates = await db.select().from(carTemplates).where(
  and(
    ilike(carTemplates.brand, `%${make}%`),
    year ? and(lte(carTemplates.minYear, year), ...) : undefined,
    lte(carTemplates.engineSize, `${(engineL + 0.1).toFixed(1)}`)  // ← upper bound only, string compare
    // gte lower bound is completely missing
  )
)
```

**Steps:**

1. The `carTemplates.engineSize` column stores values like `"1.4L"`. String `lte`/`gte` comparisons are unreliable for numerics (e.g. `"0.9L" < "1.0L"` happens to work but `"1.0L"` vs `"10.0L"` would not). Use a `sql` cast to strip the `L` suffix and compare numerically:

```ts
import { sql, and, gte, lte, ilike, or, eq } from 'drizzle-orm'

const lo = parseFloat((engineL - 0.1).toFixed(1))
const hi = parseFloat((engineL + 0.1).toFixed(1))

// Cast varchar "1.4L" → numeric by stripping non-numeric chars
const engineNumeric = sql<number>`CAST(regexp_replace(${carTemplates.engineSize}, '[^0-9.]', '', 'g') AS numeric)`

templates = await db.select().from(carTemplates).where(
  and(
    ilike(carTemplates.brand, `%${make}%`),
    year ? and(lte(carTemplates.minYear, year), or(eq(carTemplates.maxYear, 0), gte(carTemplates.maxYear, year))) : undefined,
    gte(engineNumeric, lo),
    lte(engineNumeric, hi)
  )
).limit(20)
```

2. The cc → L conversion on line 90 (`Math.round(engineCc / 100) / 10`) is correct — 999cc → 1.0L, 1390cc → 1.4L. No change needed there.

3. Verify the `preview.engineCc` value returned to the frontend is the raw cc figure so it can be displayed accurately if needed.

---

## 20. UK Vehicles Showing Up in NL Searches (Region Mismatch)

**What:** When searching by plate for NL, existing UK vehicles (stored in `vehicles` table) can appear in results — and vice versa.

**File:** `server/api/cars/lookup.post.ts`

**Steps:**

1. The schema has two separate tables: `cars` (NL) and `vehicles` (UK/IE). The `licensePlates` table references both via `carId` and `vehicleId`.
2. When looking up an existing plate, filter by the relevant table: if `country = 'nl'`, only match plates where `carId IS NOT NULL`; if `country = 'uk'` or `'ie'`, only match plates where `vehicleId IS NOT NULL`.
3. Add this condition to the existing plate lookup query in `lookup.post.ts`.

---

## 21. Link Previous Customer — Incorrect Prompt Behavior

**What (a):** After a customer is already linked to a job, the car lookup still prompts "link previous customer".
**What (b):** Adding a customer with a linked license plate does not prompt to link the car from a previous visit.

**File:** `app/components/visits/CarLookup.vue`

**Steps:**

**(a)** Pass a `hasCustomer` prop into `CarLookup`. If `hasCustomer` is true, do not render the "link previous customer" checkbox (line ~127) even when `result.previousCustomer` exists.

**(b)** In `CustomerForm.vue` (or wherever the customer is created), after saving, check if any `licensePlates` previously linked to that customer exist. If so, offer a prompt to re-link the car. This requires a new endpoint or extending the customer-save response to include prior plates.

---

## 22. Privacy / Data Policy Section in Settings

**What:** Add a section at the bottom of the settings page stating that no personal information is shared or used for marketing.

**File:** `app/pages/settings/index.vue`

**Steps:**

1. At the bottom of the settings page template, add a `UCard` or simple text block:
   - Title: "Your Privacy"
   - Body: "We do not share, sell, or use your garage or customer information for any purpose other than operating this service. We will never send letters or unsolicited communications to your customers."
2. No backend changes needed.

---

## 23. Skoda Fabia (NL) Search Returns No Results

**What:** Searching "sokda Fabia" (likely "Skoda Fabia") returns nothing in NL reference data.

**File:** `server/api/reference/car-templates.get.ts`

**Steps:**

1. Read `car-templates.get.ts` — check how `search` is applied (likely `ilike(brand, ...)` or `ilike(make, ...)`).
2. The search may be matching only `brand` or only `make` separately. Skoda Fabia needs a cross-field match: `ilike(brand, '%skoda%') AND ilike(make, '%fabia%')`.
3. Apply the same multi-word split logic from #5: split search on spaces, each token must match either `brand` or `make` using `or(ilike(brand, term), ilike(make, term))`, then AND all tokens together.
4. "Škoda" is stored with a háček (Š) in the `car_templates` table, so a plain `ilike` on the ASCII letter "S" never matches. Fix options:
   - Use PostgreSQL's `unaccent` extension: `unaccent(brand) ilike unaccent('%skoda%')`. This requires `unaccent` to be enabled in the DB (run once: `CREATE EXTENSION IF NOT EXISTS unaccent;`).
   - Or add a normalized `brand_slug` / `brand_search` column pre-populated with ASCII-folded values and query that instead.
   - Quickest server-side workaround without a schema change: if the search term matches known brand aliases (e.g. `skoda → Škoda`), substitute before querying. Maintain a small alias map in the endpoint.
