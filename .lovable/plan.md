## Goal
A simple ID-card style people registry: capture a photo with the webcam, add first name / last name (+ optional email), save, then immediately return to a fresh camera view for the next person. All users are listed as ID-photo entries you can view and edit. Everything persists in Lovable Cloud (Postgres + Storage) so nothing is lost.

## Pages
1. `/` — **Capture** (home)
   - Live webcam preview via `getUserMedia`.
   - "Take photo" button freezes the frame into a preview.
   - "Retake" reopens the live camera.
   - Form fields: First name (required), Last name (required), Email (optional).
   - "Save" uploads the photo to Storage, inserts the user row, clears the form, and returns to the live camera automatically — ready for the next person.
   - Link to `/people`.

2. `/people` — **Directory**
   - ID-badge style list: each entry shows the portrait photo prominently (portrait aspect, like an ID card), with name / last name / email underneath.
   - Each entry has an Edit action.

3. `/people/$id` — **Edit**
   - Shows the current photo, allows retaking with the webcam or keeping existing.
   - Edit first name / last name / email.
   - Save updates the row (and replaces the image in Storage if retaken).
   - Back link to `/people`.

## Backend (Lovable Cloud)
- Table `public.people`: `id uuid pk`, `first_name text not null`, `last_name text not null`, `email text null`, `photo_path text not null`, `created_at timestamptz default now()`.
- Storage bucket `people-photos` (public read) for portrait JPEGs.
- Auth: no login required — this is a single-operator kiosk-style tool. RLS with permissive policies scoped to `anon` for read/insert/update (documented tradeoff: anyone with the URL can read/write; can lock down later if the user wants auth).

## Data flow
- Server functions in `src/lib/people.functions.ts`:
  - `listPeople()` — returns all rows ordered by `created_at desc`.
  - `getPerson({ id })`
  - `createPerson({ firstName, lastName, email, photoBase64 })` — uploads to Storage, inserts row.
  - `updatePerson({ id, firstName, lastName, email, photoBase64? })` — optionally replaces photo.
- Client uses TanStack Query (`ensureQueryData` in loaders, `useSuspenseQuery` in components, `useMutation` + `invalidateQueries` on save).

## Safety against data loss
- Save button disabled until a photo is captured AND both names are filled.
- Mutation only clears the form / resets camera after the server confirms success.
- On error a toast appears and the captured photo + entered fields remain intact so nothing is lost.

## Design
Clean, neutral, kiosk-friendly: white background, rounded camera viewport with subtle border, big primary action buttons. Directory renders portraits in a responsive grid of ID-card tiles (portrait 3:4 photo on top, name block below), matching the "ID picture" feel.

## Tech notes
- TanStack Start routes under `src/routes/` (`index.tsx`, `people.tsx`, `people.$id.tsx`).
- Webcam handled client-only in `useEffect` (no SSR access to `navigator.mediaDevices`).
- Captured frame drawn to an offscreen `<canvas>` then exported as JPEG data URL, sent to the server fn, decoded and uploaded to Storage.
