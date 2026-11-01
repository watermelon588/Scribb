# Prototype verification

Verified on November 1, 2026, using local Google Chrome and Playwright.

- `npm run build`: TypeScript and production bundling passed.
- `npm test`: all six browser integration tests passed.
- Forward/reverse browsing and cover opening verified for all three presets.
- All four page ratios verified against the actual untransformed page geometry.
- All three motion modes, back-cover boundaries, and settings persistence checked.
- Local image replacement, odd page counts, restoring samples, and invalid file
  rejection checked.
- 390 px mobile viewport checked for horizontal overflow and reduced-motion
  keyboard navigation.
- Mouse corner dragging verified in both directions.
- Emulated mobile touch swipes verified in both directions. Vertical gestures
  scroll the studio without turning a page.
- Desktop, mobile, closed covers, open spreads, and intermediate turn frames
  inspected visually. The 16:9 layout was separately checked at both sizes.
- No uncaught browser errors during the three-preset navigation test.

The browser tests use Chromium/Chrome. Touch verification is emulated; this does
not replace later feel-testing on physical iOS and Android devices when selecting
the final design. The project has no backend or remote artwork persistence.

Local QA captures are in the ignored `.reference-analysis/` directory. The
development server is available at http://localhost:5173/ while running.
