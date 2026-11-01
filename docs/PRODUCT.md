# Product scope

## The eventual product

An artist's profile is a collection of customizable digital sketchbooks: watercolor,
digital painting, pencil studies, and any other practice the artist wants to keep
separate. Each sketchbook holds one artwork on each page. Visitors open it, turn
pages, react, and discover its creator. A feed surfaces popular or engaged-with
sketchbooks. Artist profiles also hold external social/contact links.

There is no comment section. The sketchbook and the artist's portfolio are the
product's differentiators. The project name has not been chosen.

## Current milestone: choose the book

Three material/typographic studies, three page-turn styles available in each,
customizable cover color/title and page aspect ratio, paper grain, local artwork
preview, and a responsive studio in which to compare them. Frontend only.

## Next, after a design is selected

1. Refine the selected material, opening sequence, and responsive reading behavior.
2. Design the profile/portfolio as a collection of books using the same renderer.
3. Design the feed, reactions, and navigation into a creator's portfolio.
4. Add identity and persistence with a small backend. Persist artwork metadata,
   page order, book settings, and profile links; use an image platform such as
   Cloudinary for media. Make uploads authorized server-side.

The existing `Artwork` interface and independent book props are the integration
boundary. Keep service credentials out of the frontend. Decide providers and data
schema when the persistent-storage milestone begins, rather than scaffolding
unused services now.
