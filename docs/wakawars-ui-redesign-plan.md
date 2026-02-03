# WakaWars UI Redesign Plan

**Current State (Repo Analysis)**
The renderer UI is a single file (`apps/wakawars/src/renderer/App.tsx`) with all flows (welcome, sign‑in, sign‑up, league, settings) and a single stylesheet (`apps/wakawars/src/renderer/styles.css`). The league view shows a flat list of rows with rank/time on the right and a docked “Add friend” card. Settings are a linear stack of cards. Data inputs are limited to daily and weekly leaderboard responses, session state, and configuration. There is no existing component or design system, and UI logic is intertwined with data loading and session state. The shared package provides leaderboard ranking helpers and is already tested with Vitest (`packages/shared/test/leaderboard.test.ts`).

**Constraints**
The app runs as a macOS menu bar utility, so dense, glanceable UI with clear hierarchy is necessary. Data is local‑first and limited to daily/weekly totals, ranks, and status states (`ok`, `private`, `not_found`, `error`). The redesign must not assume new API endpoints or additional metrics.

---

## Three Proposal Directions

**Proposal A: “Podium + Near‑Me” (Competitive, Glanceable)**
Focus on competition with a podium for top 3, a “Your Rank” summary, and a “Near You” micro‑leaderboard (one rank above and below). The full list is still available below. Emphasizes micro‑comparisons to reduce demotivation while keeping the competitive tone. Uses only existing data.

Tradeoffs
Less emphasis on personal progress/streaks; relies on rank/time for engagement.

**Proposal B: “Progress‑First” (Personal Mastery)**
Foreground personal progress (today vs weekly average, personal delta vs last update) and show the global list only after a personal card. Uses soft competitive framing and reduces pressure. Still uses existing data, but the focus is less “league‑like.”

Tradeoffs
Less competitive by default; may not satisfy users seeking rivalry.

**Proposal C: “Social Clubs” (Teams & Challenges)**
Introduce club badges, weekly challenges, and team‑based leaderboards. This is most socially rich but would require new backend data models and APIs (teams, challenges), which are not available.

Tradeoffs
Requires server changes and new data not currently available.

**Chosen Direction**
Proposal A is the best fit because it maximizes competitive clarity while staying within current data and research‑backed guidance (macro + micro leaderboards, near‑me comparisons). It preserves WakaWars’ rivalry identity and supports menu‑bar glanceability without backend work.

---

## Redesign Plan (Comprehensive)

**Phase 1: Data & View‑Model Layer**
1. Add shared helper(s) to slice a leaderboard into:
   - `podium` (top 3 ranked)
   - `nearMe` (self plus one above/below if available)
   - `rest` (remaining entries)
2. Handle edge cases:
   - No entries at all
   - Self not present in entries
   - Only 1–2 ranked entries
   - Mixed status entries (`private`, `not_found`, `error`) that lack ranks/time
   - Ties for rank (same total seconds)

**Phase 2: League Screen Layout**
1. Replace the current flat list with:
   - **League Header**: title + updated time + Today/Week switch
   - **Summary Card**: “Your standing” (rank, total time, delta vs leader)
   - **Podium Card**: top 3 ranks with medals
   - **Near‑You Card**: ±1 around self (micro leaderboard)
   - **All Players**: full list below with compact rows
2. Provide a consistent status display for non‑ranked users:
   - `Private`, `Not found`, `Error` badges in place of time
3. Add a “No friends yet” empty state that points to Add Friend.

**Phase 3: Add‑Friend & Settings Flow**
1. Convert Add Friend into a “Call to Action” block that appears:
   - inline in the league view when list is short
   - docked when the list is long (preserve existing behavior)
2. Settings redesign:
   - Group settings into Account, Security, System
   - Add compact rows with clear labels and secondary text

**Phase 4: Visual System (CSS)**
1. Standardize row heights and alignments across all leaderboard rows.
2. Use a three‑column grid for leaderboard rows:
   - left: avatar + name
   - center: status/delta
   - right: rank + time
3. Add hierarchy to cards with subtle separators and stronger typography for key stats.
4. Preserve current color palette, borders, and shadows to keep visual continuity.

**Phase 5: Accessibility & UX**
1. Ensure minimum tap targets and readable text sizes.
2. Add `aria-label` where icon‑only buttons exist.
3. Provide visible loading/empty/error states for each section.

**Phase 6: Tests**
1. Add tests in `packages/shared/test/leaderboard.test.ts` for new leaderboard slicing helper(s).
2. Validate edge cases (missing self, fewer entries, ties).

**Phase 7: Rollout**
1. Implement feature‑flagged layout (default on).
2. Verify `bun run build` for renderer.
3. Sanity check weekly and daily tabs, settings, and error flows.

---

## Implementation Targets (What Will Change)
1. **Shared**: new helper in `packages/shared/src/leaderboard.ts` and tests.
2. **Renderer**: new leaderboard layout and summary cards in `apps/wakawars/src/renderer/App.tsx`.
3. **Styles**: new layout and component styles in `apps/wakawars/src/renderer/styles.css`.

