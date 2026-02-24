# Changelog

## 0.2.0

### New Features

- Fallback TOC extraction: headings → numbered patterns → bold text
  - Numbered pattern support: Chinese numbering (第一章, 一、, (一)), Roman numerals, Arabic numerals
  - Bold text detection: paragraphs starting with `<strong>`/`<b>` (≤10 chars) are treated as headings

### Improvements

- Support `h1` tags in heading extraction with level normalization (min level maps to 2)
- Relax numbered pattern matching: dot after Roman/Arabic numerals no longer requires a trailing space
- Bold detection now checks only the first non-whitespace child node; TOC entry uses bold text instead of full paragraph

## 0.1.0

- Initial release
- Fixed TOC panel on the right side for article navigation
- Scroll tracking with IntersectionObserver
- Support for normal view and reader view
