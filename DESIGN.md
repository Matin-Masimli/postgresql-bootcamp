# Design: "The Line"

The course is a metro network. Five stages are five coloured lines; twenty-one topics are
stations. Progress is shown as stations you have passed. Everything else on the page stays
quiet, so the colour belongs to the lines.

## Direction

- **Thesis.** Learning SQL is a journey with a known route. The map shows the whole route,
  where you are on it and what comes next.
- **Own world.** A transit schematic: bold lines, 45° bends, white interchange rings,
  numbered line badges, a passenger display for the next stop. No generic SaaS cards,
  gradients, glass or decorative kickers.
- **Story.** Home shows the network (map on wide screens, a pocket map on phones). A topic
  page shows its line as a strip with the current station large. A question page keeps
  only a line badge and the station dot. Reading and solving stay calm.
- **First viewport.** Headline, the next-stop display and the map drawing itself in.

## Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--line-1` Foundations | `#0071e3` | `#0a84ff` | line, badge |
| `--line-2` Combining data | `#1f8a3d` | `#30d158` | line, badge |
| `--line-3` Functions | `#f59e0b` | `#ffb340` | line, badge (dark ink) |
| `--line-4` Analytics | `#d70f2a` | `#ff453a` | line, badge |
| `--line-5` Advanced queries | `#0a7f92` | `#40c8e0` | line, badge |
| `--line-n-ink` | white or near black | | text on a line colour, at least 4.5:1 |
| page | `#f5f5f7` | `#000` | Apple greys (the `zinc` scale is remapped) |
| accent | `#0071e3` | `#0a84ff` | buttons, links, focus |

Components get a line's colour through `lineVars(n)`, which sets `--lc` and `--lc-ink`.
Teal replaces violet for "visualize" and "interview".

**Type.** Display (`h1`–`h4`, badges, the map) is Overpass, a face drawn after highway and
transit signage. Body is the system face at 17px. Code is the system monospace.

## Motion

Curves: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` for entrances,
`--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` for movement on screen. Only transform,
opacity and SVG stroke offset are animated.

- **Map draw-in** (once per session): each line draws in 600ms, starting 300ms after the
  previous one; stations land as their line reaches them; labels follow 60ms later.
- **You are here**: a ring that keeps leaving the current station (1.8s).
- **Page changes**: View Transitions API. The old page fades (150ms), the new one rises in
  (260ms). A station keeps its `view-transition-name`, so the map dot travels to the topic
  page's strip and on to the question page. The header stays put. Browsers without the
  API just swap pages.
- **Hover**: stations grow slightly, the next-stop display lifts 2px, cards lift. Hover
  only applies on devices that can hover.
- **Reduced motion**: no draw-in, no pulse, no page transitions; content appears in place.

## Rules

- No kicker or eyebrow above a page title. Small neutral group labels use `label`.
- No unicode glyphs as icons. Use `components/Icons.tsx` or an inline SVG.
- No gradient text and no purple.
- The map paper (dot grid) sits only behind maps, never behind reading.
- Map and topic data come from `src/lib/metro.ts` (lines, geometry, station state).
