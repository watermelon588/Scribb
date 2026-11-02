# UI system

One set of rules for the app's chrome: headers, toolbars, studio panels, dialogs,
forms and tooltips. Tokens and components live in `src/system.css`, which loads
last. Colors stay in `src/theme.css` (one olive palette, light and dark).

Book rendering is outside this system: paper, covers, spines, journal sheets and
their typography, stickers and scribbles keep their own styles.

## Tokens (`:root`)

| Group | Tokens |
|---|---|
| Spacing | `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 24 · `--space-6` 32 · `--space-7` 48 · `--space-8` 64 |
| Type | `--text-xs` 12 · `--text-sm` 13 · `--text-md` 15 · `--text-input` 16 · `--text-lg` 18 · `--text-xl` 24 · `--text-2xl` 32 · `--text-display` clamp(36–60) |
| Weight | `--weight-light` 350 (display only) · `--weight-regular` 400 · `--weight-medium` 500 (badges only) |
| Shape | `--radius` 0 · `--control` 40px (44px on phones and touch) |
| Color | `--app-bg` `--app-panel` `--app-ink` `--app-muted` `--app-line` `--app-selected` `--app-accent` `--app-button` `--app-button-ink` `--app-danger`, each with a dark value under `:root[data-theme=dark]` |

Use the scale; no in-between values. Chrome text is never smaller than 12px.

## Type

- Display (`--text-display`, light, -0.03em): one page title — artist name, another artist's name, reading-page title, guest welcome.
- `--text-2xl`: dialog and settings titles. `--text-xl`: section headings (Your sketchbooks, Your artwork, a selected shelf book). `--text-lg`: card titles. `--text-md`: body copy. `--text-sm`: buttons, nav, secondary copy. `--text-xs`: labels, counts, captions, footers.
- Editorial keeps its serif family; sizes come from the same scale.

## Buttons

Square corners, one height (`--control`), 13px regular text, 8px icon gap, 16px side padding.

| Class | Use |
|---|---|
| `button-primary` | The one main action in a view: Save, Sign in, Create, Follow. Filled with `--app-button`. |
| `button-secondary` | Other actions with a label: Open, Upload, Load more, Following. 1px `--app-line` border. |
| `button-quiet` | Low-emphasis text actions and filter toggles: feed categories, Gallery/Bookshelf. No border. |
| `button-icon` | Every icon-only control. Square `--control` box, no border, muted icon; needs `aria-label` and a tooltip (`data-hint` or `title`). Add `button-secondary` for a bordered icon (the book's middle control); add `button-primary` for a filled one (Send). |
| `button-link` | Inline text links inside copy (Forgot password, Privacy). |

Pressed toggles (`aria-pressed=true`) fill with `--app-selected`; a secondary also turns its border `--app-accent`.
Choice tiles are secondary buttons laid out as tiles. Labeled choices (visibility, category, binding, format, paper, page turn, journal font and size) carry the 1px border; glyph pickers (journal layouts, cover layouts, scribbles) draw their own frame, so their border shows only on hover and selection. Selection looks the same in both.
Tabs (Sketchbook / Journal, header nav) are text with an underline for the current one.
Swatches (cover, ink, elastic colors) and avatars stay round: they show content, they are not buttons in the system.

Focus: `:focus-visible` draws a 2px `--app-accent` outline 2px outside the control.

## Fields

- Text fields are underlined: no box, 1px `--app-line` bottom border, 8px vertical padding, 16px text, placeholder in `--app-muted`.
- Writing areas (journal paragraph, Ask your journal) are boxed: 1px `--app-line` border, `--radius`, 16px padding.
- Focus never uses an outline on a text field, so nothing crosses the placeholder or the label. The border turns `--app-accent` and the underline thickens below the text (box-shadow outside the field).
- Search fields put the underline on the row that holds the icon and the input.
- Labels: `--text-xs`, muted, 8px above the field. Groups of controls are 24px apart.
- Inputs stay 16px on phones so iOS does not zoom.

## Spacing

- Page gutter: 5% (max width 1480px), 20px on phones.
- Between sections: `--space-7` (48). Between a heading and its content: `--space-5` (24). Between controls in a group: `--space-2` (8). Between control groups: `--space-5` (24).

## Divider lines

Space separates content. A line is allowed only for:

1. the header's bottom edge and the phone navigation's top edge;
2. rows of a list of like items (notifications, Ask starters, Editorial catalogue rows);
3. a text field's underline;
4. the "or" between sign-in methods;
5. the bookshelf's shelf.

No lines between toolbar and grid, above footers, between card image and caption, between answers, or beside tool groups.
