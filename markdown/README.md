# AIoT EV Co-Driver Simulator · Version 2

Version 2 adds a traffic-aware, address-to-address route simulation to the existing EV telemetry and n8n coaching demo. The map route and traffic come from Google Maps; the vehicle position, speed, battery, energy use, and settings remain simulated.

## Run the simulator

Google Maps key restrictions work best when the page is served from localhost, rather than opened through `file://`. From this folder run:

```bash
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080/` in a modern browser, expand **Connect Google Maps for live route and traffic**, and enter your API key. The key is held in this browser session and is sent to Google Maps; allow the origin you actually use in the key restrictions and restrict the key to Maps JavaScript API and Routes API. Billing must be enabled for traffic-aware route calculations. `localhost` and `127.0.0.1` have separate browser storage and may need separate referrer restrictions.

Enter an origin and destination and select **Navigate** once. The map shows the requested driving route, ETA, route distance, traffic colouring, and a simulated vehicle marker. When a simulated drive is running, traffic is refreshed in the background every two minutes. The route coach can suggest ECO for slow or heavy traffic; the driver must press **Apply ECO mode**. This changes the simulator setting only.

The arrival SOC figure is a rough model estimate using a generic 180 Wh/km assumption. It is not a measured vehicle prediction. The simulator's separate battery and energy-flow model remains available alongside it.

## Files

Edit the files in this folder directly:

- `simulator.js` — driving simulation, session controls, telemetry, JSONL/CSV export, and n8n delivery
- `navigation.js` — Google Maps route calculation, traffic refresh, map animation, and route context
- `index.html` — page structure and controls
- `styles.css` — visual design
- `DESIGN.md` — how to change the page safely
- `n8n-evaluator-v3-reviewed.js` — reviewed evaluator code published to the local workflow
- `n8n-workflow-before-connection-fix.json` — workflow backup from before the coach update
- `terrain-demo.html` and `terrain-demo.js` — terrain demonstration
- `N8N_RAG_INGESTION.md` — telemetry and n8n integration notes

## Exports

Each drive session begins with **Start vehicle**. On **Stop vehicle & export**, the simulator produces:

- `.jsonl` — machine-readable event stream for n8n/RAG and model training
- `.csv` — flattened, spreadsheet-friendly version for people

You can also download either format at any time using the controls in the Telemetry Connection panel. Webhook batches now include the current `route_context` (traffic classification, remaining distance, traffic ETA, normal ETA, update time, and route endpoints) alongside the existing simulator events.

The updated local n8n evaluator considers fresh slow or heavy traffic when there is no vehicle warning. Vehicle warnings take priority. The route card also gives a local traffic advisory. RAG is not configured in the tested workflow.
