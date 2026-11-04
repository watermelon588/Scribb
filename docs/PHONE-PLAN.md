# Phone layout plan

Scope: phones only (`max-width: 600px`, the breakpoint the app already uses for the
bottom navigation). Desktop and tablet markup and styles stay as they are. Every
phone rule lives in `src/phone.css`, which loads last, and every phone-only control
is hidden above 600px.

Reference patterns: Instagram and X for the feed and profile (one column of posts,
a "For you" switch in the corner, icon tabs on the profile, no search or sort on the
home feed), InShot and VSCO for the editor (preview on top, one tool panel, a
horizontal row of tool icons under the thumb, publish details asked for at save).

## 1. Everywhere on phones
- No Gallery/Editorial switch. Phones always use the Gallery style; a stored
  Editorial choice still applies on desktop.
- No Bookshelf preview on phones; the gallery grid is the only view.

- The header’s More options menu holds the information links, Feedback and Install app. Phones have no footer.

## 2. Explore (feed)
- Show the most recent leaf at full card width for individual works. Keep both halves for a continuous spread. The leaf sets the journal text scale.
- Removed on phones: category buttons, Everyone/Following buttons, the saved
  toggle, the search field, the side note, the numbered edition marks and the
  duplicate "Made by hand" line.
- One small "For you ⌄" button at the top opens a bottom sheet (native popover,
  dismissed by tapping outside) with For you, Following, Saved and the three
  categories. The button names the current view.
- Cards read like posts: author row, the book, then title with like and save.

## 3. Portfolio and other profiles
- Removed on phones: search, Gallery/Bookshelf switch and the New button (Create is
  in the bottom navigation).
- Sketchbooks/Journals become two equal tabs, like a profile's grid tabs.
- Books show in a two-column grid with one-line titles.

## 4. Creation studio (sketchbook and journal)
- Full-screen editor: the site header, footer and bottom navigation are hidden while
  editing. The top bar keeps Back, the Sketchbook/Journal switch, Discard and Save.
- The book preview fills the space between the top bar and the tools, so every
  change is visible as it happens.
- A tool bar of icon buttons sits at the bottom. One tool panel opens above it at a
  time (at most about 40% of the screen, scrolling inside), and tapping the open
  tool again closes it to give the preview the whole screen.
  - Sketchbook: Pages (artwork), Cover (artwork, color, elastic), Binding, Paper
    (format, paper, page turn).
  - Journal: Pages, Cover (artwork, color, layouts, cover text, stickers), Paper
    (format, page turn), Presets.
  - Writing a journal page: Write (text or picture), Layout, Decorate (scribbles and
    stickers), Style (paper, lines, font, size, ink, watermark).
- The active tool uses a horizontal editing rail. Keep fields editable, thumb targets reachable and long choices swipeable without shifting the preview. Sketchbooks of individual works turn one page at a time on phones. Books containing a continuous artwork spread keep both pages together.
- Name, cover caption, journal description, visibility and category move to a
  bottom sheet that opens from Save. The sheet's own Save button saves the book.

## 5. Accounts and information pages
- Sign-in, settings and notifications already open full screen on phones; they get
  safe-area padding and tighter spacing. Privacy and Terms keep the reading layout
  with phone margins.

## Checks
- `npm run build` and `npm test`.
- Look at 320px and 390px: Explore, portfolio, a new sketchbook (every tool), a new
  journal (every tool, a written page), the save sheet, sign-in and settings.
- Look at desktop to confirm it is unchanged.
