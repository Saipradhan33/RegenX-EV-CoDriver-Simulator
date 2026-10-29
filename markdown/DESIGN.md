# Simulator V2 design guide

This folder is a local web app. Edit `index.html` for the page structure and text, and `styles.css` for colours, spacing, type and responsive layout. `simulator.js` handles the vehicle model, n8n connection and controls; `navigation.js` handles the map and route. Make a copy of the folder before a major redesign.

## Colours and typography

At the top of `styles.css`, `:root` defines the shared colours: `--ink` (text), `--muted`, `--surface`, `--edge`, `--lime`, `--amber` and `--danger`. Changing these variables updates multiple cards. Body, headings, buttons and labels have separate rules. Google Fonts are optional for the demo: the stylesheet falls back to system fonts when offline.

## Page sections

- `.navigation-heading` and `.route-form`: title, From/To inputs and Navigate button.
- `.drive-actions`: Start/Stop, Reset and the compact keyboard guide.
- `.map-setup`, `.map-frame`, `.map-overlay`, `.map-legend`: map connection, map and labels. Preserve the Google attribution displayed inside the map.
- `.route-summary` and `.route-coach`: ETA, distance, model estimate and traffic advice.
- `.sim-grid`, `.drive-card` and `.telemetry`: speed, battery, co-driver, energy, inputs and connection cards.
- `.operator-console` and `.switch-card`: drive-mode and regeneration buttons.

The last part of `styles.css` contains the V2 map layout and responsive rules; later declarations can override earlier ones. Check narrow and wide windows after changes. The breakpoint at 620 px stacks the route inputs and actions.

## Keep the app connected

You can change visible labels and move whole elements, but preserve the existing element IDs, button `data-mode` and `data-regen` values, script order, and the `#map` element. The JavaScript uses them to update the screen. Keep the API key field as a password input and do not put a real key into the files.

The route card describes Google traffic context. The n8n card shows the latest verified n8n response. Speed, road grade, energy and battery figures are simulator outputs. The arrival SOC is a simple model estimate. A setting is applied only when the driver presses the relevant button.

## Check a redesign

1. Start the local server as described in `LOCAL_DEMO.md` and open the simulator in a browser.
2. Type a location containing spaces, connect Maps, and check the route, ETA and map attribution.
3. Save the published n8n webhook URL and start a drive. Confirm the status becomes **N8N CONNECTED** and the latest evaluated sample time updates.
4. Accelerate, release the controls, and confirm that an old warning clears when a later normal response arrives. Stop the workflow or use an invalid URL and confirm the screen reports a disconnect rather than showing an old decision as live.
5. Check the mode and regeneration buttons, the driver-confirmed Apply button, and JSONL/CSV exports. Repeat at a narrow window width.
