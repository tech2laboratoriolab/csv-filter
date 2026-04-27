# Umami Analytics Map — CSV Filter Pro (LAB)

> Generated on: 2026-04-24
> Purpose: Event and payload inventory for AI-driven analytics and insight generation.

## Setup

| Field            | Value                                              |
|------------------|----------------------------------------------------|
| Umami Instance   | `https://umamilab.ngrok.dev`                       |
| Script URL       | `https://umamilab.ngrok.dev/script.js`             |
| Website ID       | `0079c6e7-052d-4ced-abb0-ed0e81239a80`             |
| Tracking Hook    | `useTrack()` from `lib/useTrack.ts`                |
| Type Declaration | `lib/umami.d.ts`                                   |

### Payload Type Contract

All event payloads are constrained to:
```ts
Record<string, string | number | boolean>
```

---

## Event Map

### CSV & Data Management

> Events related to loading, processing, and exporting CSV data on the main page.

| Event | Payload | File | Line | Trigger |
|-------|---------|------|------|---------|
| `csv_upload` | `{ rows, merged, skipped }` | `app/page.tsx` | L328 | User selects and uploads a CSV file |
| `filter_applied` | `{ conditions }` | `app/page.tsx` | L432 | User clicks "Apply filters" button |
| `filter_cleared` | *(none)* | `app/page.tsx` | L438 | User clicks "Clear filters" button |
| `csv_exported` | `{ rows }` | `app/page.tsx` | L652 | User clicks "Export CSV" on main page |
| `reset_all` | *(none)* | `app/page.tsx` | L554 | User confirms "Reset all data" (destructive action) |

### Filter Management

> Events related to creating, saving, deleting, and editing named filters.

| Event | Payload | File | Line | Trigger |
|-------|---------|------|------|---------|
| `filter_created` | `{ name }` | `app/page.tsx` | L501 | User saves a new named filter from the main page |
| `filter_deleted` | *(none)* | `app/page.tsx` | L542 | User deletes a saved filter |
| `filter_saved` | `{ name }` | `app/filters/[id]/FilterPageClient.tsx` | L161 | User saves changes to an existing filter in the filter editor |
| `csv_exported` | `{ rows, filter_name }` | `app/filters/[id]/FilterPageClient.tsx` | L180 | User exports filtered data from the filter details page |
| `filter_tab_changed` | `{ tab }` | `app/filters/[id]/FilterPageClient.tsx` | L280 | User switches between editor tabs |

### Schedule Management

> Events related to weekly pathologist schedule management (Semanas module).

| Event | Payload | File | Line | Trigger |
|-------|---------|------|------|---------|
| `schedule_saved` | `{ week }` | `app/semanas/SemanaClient.tsx` | L169 | User saves the pathologist schedule for a week |
| `week_navigated` | `{ direction, week }` | `app/semanas/SemanaClient.tsx` | L183 | User clicks next/previous week navigation |

### Messaging

> Events related to WhatsApp batch messaging.

| Event | Payload | File | Line | Trigger |
|-------|---------|------|------|---------|
| `whatsapp_message_sent` | `{ count }` | `app/whatsapp/page.tsx` | L967 | User sends a batch of WhatsApp messages |

---

## Detailed Payloads

### `csv_upload`

| Property | Type | Possible Values | Description |
|----------|------|-----------------|-------------|
| `rows` | `number` | positive integer | Total number of data rows after upload (excluding header) |
| `merged` | `number` | integer ≥ 0 | Rows merged during deduplication |
| `skipped` | `number` | integer ≥ 0 | Rows skipped due to invalid format or deduplication |

### `filter_applied`

| Property | Type | Possible Values | Description |
|----------|------|-----------------|-------------|
| `conditions` | `number` | positive integer | Number of active filter conditions applied |

### `csv_exported` (main page — `app/page.tsx`)

| Property | Type | Possible Values | Description |
|----------|------|-----------------|-------------|
| `rows` | `number` | positive integer | Number of rows in the exported CSV |

### `csv_exported` (filter page — `app/filters/[id]/FilterPageClient.tsx`)

| Property | Type | Possible Values | Description |
|----------|------|-----------------|-------------|
| `rows` | `number` | positive integer | Number of rows in the exported CSV |
| `filter_name` | `string` | any string | Name of the filter used for export |

### `filter_created`

| Property | Type | Possible Values | Description |
|----------|------|-----------------|-------------|
| `name` | `string` | any string | Name given to the new filter by the user |

### `filter_saved`

| Property | Type | Possible Values | Description |
|----------|------|-----------------|-------------|
| `name` | `string` | any string | Name of the filter being saved/updated |

### `filter_tab_changed`

| Property | Type | Possible Values | Description |
|----------|------|-----------------|-------------|
| `tab` | `string` | `"columns"`, `"filters"`, `"color"`, `"formula"`, `"annotation"`, `"template"` | The tab the user switched to in the filter editor |

### `schedule_saved`

| Property | Type | Possible Values | Description |
|----------|------|-----------------|-------------|
| `week` | `string` | ISO date string (e.g. `"2026-04-04"`) | The week (start date) of the schedule being saved |

### `week_navigated`

| Property | Type | Possible Values | Description |
|----------|------|-----------------|-------------|
| `direction` | `string` | `"next"`, `"prev"` | Which direction the user navigated |
| `week` | `string` | ISO date string (e.g. `"2026-04-11"`) | The resulting week after navigation |

### `whatsapp_message_sent`

| Property | Type | Possible Values | Description |
|----------|------|-----------------|-------------|
| `count` | `number` | positive integer | Number of WhatsApp messages sent in the batch |

---

## User Journeys

### 1. Upload and Quick Export
> User uploads a CSV file and exports filtered results without saving a filter.

```
csv_upload → filter_applied → csv_exported
```

**Possible metrics:**
- Conversion rate: upload → export
- Average number of conditions applied before export
- Distribution of exported row counts vs uploaded row counts

---

### 2. Upload and Save Filter
> User uploads CSV, applies filters, and saves the configuration for future use.

```
csv_upload → filter_applied → filter_created
```

**Possible metrics:**
- Rate of users who save filters after applying them
- Average number of conditions in saved filters

---

### 3. Reuse Saved Filter and Export
> User opens an existing saved filter, edits it, and exports results.

```
filter_tab_changed (×N) → filter_saved → csv_exported (filter page)
```

**Possible metrics:**
- Most accessed tabs in the filter editor (via `filter_tab_changed.tab`)
- Rate of save → export on the filter details page

---

### 4. Data Reset
> User uploads data and later resets everything (destructive action).

```
csv_upload → [any events] → reset_all
```

**Possible metrics:**
- How much interaction happens before a reset
- Frequency of reset_all relative to uploads

---

### 5. Schedule a Week and Navigate
> User opens the schedule module, saves a schedule, and navigates to adjacent weeks.

```
schedule_saved → week_navigated → week_navigated → schedule_saved
```

**Possible metrics:**
- Average number of navigations per session in Semanas
- Most frequently scheduled weeks

---

### 6. Batch WhatsApp Messaging
> User goes to the WhatsApp page and sends a batch of messages.

```
whatsapp_message_sent
```

**Possible metrics:**
- Average batch size (`count`)
- Frequency of use over time

---

## Tracking Gaps

| Missing Event (suggested) | Justification |
|---------------------------|---------------|
| `filter_updated` | `filter_created` and `filter_deleted` exist, but there is no event for editing an existing filter's conditions or name (only `filter_saved` fires from the editor, which conflates create and update) |
| `filter_opened` | There is no event when a user navigates into the filter details page — no entry tracking for that flow |
| `reset_all_cancelled` | `reset_all` fires on confirmation, but if the user cancels the dialog there is no tracking |
| `csv_upload_failed` | There is no error event for failed uploads (invalid format, empty file, etc.) |
| `whatsapp_message_failed` | There is no event for failed or partial message delivery |
| `filter_cleared_partial` | `filter_cleared` removes all conditions; there is no event for removing a single condition |
| `schedule_viewed` | No event when the Semanas page is loaded or a week is viewed without saving |

---

## Questions for Insights

The following questions can be answered by an AI analyzing data from this Umami website:

1. **What is the upload-to-export conversion rate?** — How many sessions with `csv_upload` also result in `csv_exported`?
2. **What is the upload-to-save-filter conversion rate?** — How many sessions with `csv_upload` result in `filter_created`?
3. **Which filter editor tab is most accessed?** — Distribution of `filter_tab_changed.tab` values.
4. **What is the average file size (rows) uploaded?** — Mean and distribution of `csv_upload.rows`.
5. **How much data do users typically export vs upload?** — Ratio of `csv_exported.rows` to `csv_upload.rows` per session.
6. **How often do users reset all data?** — Frequency of `reset_all` relative to `csv_upload`.
7. **How many filter conditions do users typically apply?** — Distribution of `filter_applied.conditions`.
8. **Are users more likely to export from the main page or the filter page?** — Compare `csv_exported` events by file origin (main page has no `filter_name`, filter page does).
9. **What is the average batch size for WhatsApp messages?** — Distribution of `whatsapp_message_sent.count`.
10. **How many weeks ahead or back do users navigate before saving a schedule?** — Number of `week_navigated` events per `schedule_saved`.
11. **Which saved filters are exported most?** — Distribution of `csv_exported.filter_name` values.
12. **Is there a day-of-week pattern in schedule saves?** — `schedule_saved.week` values over time.
