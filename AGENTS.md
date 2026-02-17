# AGENTS.md — FreshRSS Table of Contents Extension

## Project Overview

A FreshRSS extension that displays a fixed Table of Contents (TOC) panel on the right side of the page for navigating long articles with multiple headings.

## Architecture

```
xExtension-TableOfContents/
├── metadata.json        # FreshRSS extension descriptor
├── extension.php        # PHP entry point — loads JS/CSS via Minz_View
└── static/
    ├── toc.js           # Core logic (~177 lines, IIFE-wrapped)
    └── toc.css          # Panel styles, responsive, theme-adaptive
```

**Design principle:** TOC is generated entirely on the client side. FreshRSS dynamically loads article content, so PHP hooks (which fire once at page load) cannot reliably generate TOC. All logic lives in `toc.js`.

## Key Components (toc.js)

| Function | Responsibility |
|---|---|
| `findActiveArticleContent()` | Locates the current article's DOM element. Supports Normal view (`.flux.active .content .text`) and Reader view (`.post`). |
| `createPanelElements()` | Creates `#toc-panel` with toggle button, title, and `<ol>` list. Idempotent — safe to call multiple times. |
| `buildTOC()` | Extracts `h2`–`h6` headings from the active article, generates a flat `<ol>` with `data-level` attributes for CSS indentation. Hides panel if fewer than 2 headings. |
| `setupScrollTracking()` | Uses `IntersectionObserver` (`rootMargin: '-20px 0px -60% 0px'`) to highlight the currently visible heading in the TOC list. |
| `watchForArticleChanges()` | Dual detection strategy: click event delegation on `.flux` elements (primary) + `MutationObserver` on `#stream` (backup). Both debounced at 250ms via `setTimeout`. |

## FreshRSS DOM Assumptions

These selectors are based on FreshRSS 1.x tested behavior:

- **Stream container:** `#stream` (NOT `#stream-content`)
- **Active article (Normal view):** `.flux.active` with content in `.content .text`
- **Reader view:** `.post` inside `#stream`
- **Article class changes:** `.active` and `.current` are added when an article is expanded

If FreshRSS updates its DOM structure, `findActiveArticleContent()` is the first place to update.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| TOC generation | Client-side JS | FreshRSS loads articles dynamically; PHP hooks only fire once |
| Scroll tracking | IntersectionObserver | Async batched; avoids scroll event performance overhead |
| List structure | Flat `<ol>` + `data-level` | RSS article headings often skip levels (h2→h5); avoids empty nesting |
| Article change detection | Click delegation + MutationObserver | Click events are deterministic; MutationObserver covers AJAX/programmatic loads |
| Min heading threshold | >= 2 | Avoids showing a useless TOC for short articles |
| Panel collapse | `transform: translateX(100%)` | GPU-accelerated, no layout reflow |
| Responsive | Hidden below 1100px | TOC panel would overlap content on narrow screens |

## CSS Theme Integration

The extension uses FreshRSS CSS custom properties with fallbacks:

- `--frss-background-color-alt` (panel background)
- `--frss-border-color` (borders, scrollbar)
- `--frss-color` (text)
- `--frss-accent-color` (active heading highlight)
- `--frss-background-color-hover` (hover states)

## Development Notes

- The extension uses `'use strict'` inside an IIFE to avoid polluting the global scope.
- `buildTOC()` cleans up the previous `IntersectionObserver` before creating a new one to prevent memory leaks on article switches.
- Heading IDs are auto-assigned (`toc-heading-N`) only when the heading doesn't already have an `id` attribute.
- The TOC panel itself scrolls independently (`overflow-y: auto`) for articles with 30+ headings.
