# Hospital prototype

A dependency-free browser prototype for a hidden-information hospital engine builder.

## Play

Open `index.html` in a modern browser, or serve this folder with any static web server.

## Current loop

1. Investigate hidden patient cards with Doctor actions.
2. Generate Nursing Care, Medication, and Surgery through staff and facilities.
3. Partially treat patients in ED; admit ward-required patients when a bed is available.
4. Complete every revealed need and discharge patients for money and reputation.
5. Buy staff and facilities, then end the round. Patient demand rises over time.

Nursing Care is limited to one icon per patient per round. Surgery needs both a Surgeon and an Operating Theatre. Untreated revealed patients deteriorate predictably, gain Nursing Care needs, and may eventually die.

## Structure

- `src/data.js` — patient, staff, facility, and market definitions
- `src/engine.js` — framework-agnostic game rules and state transitions
- `src/app.js` — browser rendering and interaction layer
- `tests/engine.test.mjs` — core rule smoke tests

The game content is data-driven so new cards can be added without changing the rendering layer.
