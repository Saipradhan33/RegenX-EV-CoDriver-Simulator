# Local presentation runbook · Version 2

The simulator runs locally in a browser. The hosted ChatGPT dashboard is **not** needed for the presentation. Version 2 uses a Google Maps API key for routing and traffic; the existing n8n workflow remains local. The path is:

`Google traffic-aware route → moving simulated EV → route advisory → driver confirmation`

`Simulator telemetry + route context → local n8n → existing evaluator response`

## One-time laptop setup

1. Keep this Version 2 folder on the presentation laptop.
2. In Google Cloud, enable Maps JavaScript API and Routes API, attach billing, create a browser API key, and restrict it to the browser origin and those APIs. Review quotas and costs before the event.
3. Run n8n locally on port `5678` and keep an export backup of its workflow.
4. Serve the simulator locally instead of opening it through `file://`. From this folder, run:

   ```bash
   python3 -m http.server 8080
   ```

   Then open `http://127.0.0.1:8080/` in a browser. Use the same origin each time: `localhost` and `127.0.0.1` have separate browser storage and can have different key restrictions.
5. In n8n, activate the workflow and use its **production** webhook URL:

   ```text
   http://localhost:5678/webhook/ev-telemetry
   ```

   For testing before activation, use `http://localhost:5678/webhook-test/ev-telemetry` only while **Listen for test event** is active.
6. Allow the simulator origin in n8n CORS settings. The current setup accepted `http://127.0.0.1:8080` during testing.
7. In the simulator, enter the API key under **Connect Google Maps for live route and traffic**. Enter an origin and destination and select **Navigate**. Then start a simulated drive and use the arrow keys to move the vehicle along the route.

## n8n response contract

The Code node must return JSON directly through **Respond to Webhook** using:

```text
={{ JSON.stringify($json) }}
```

The simulator displays the latest verified n8n `warnings` or `recommendation`, and enables the n8n setting button when a response includes:

```json
"suggested_settings": {
  "drive_mode": "ECO",
  "regen_level": "STRONG"
}
```

That button changes simulator settings only after a click and records the action. The local route card separately suggests ECO when traffic includes slow or heavy sections. The reviewed n8n evaluator also uses fresh route context when no vehicle warning takes priority. The telemetry connection reports a verified response, shows its sample time, and clears stale decisions if communication fails. Failed events remain in the local session export; old batches are not replayed as live decisions.

## Presentation-day check

1. Start local n8n and open the workflow.
2. Start the local HTTP server and open the simulator at `http://127.0.0.1:8080/`.
3. Confirm the simulator webhook field uses the local production URL and press **Save endpoint**.
4. Plan a route with unambiguous locations including the city, start the drive, and check **N8N CONNECTED** and the evaluated sample time. Verify the displayed route and distance before demonstrating.
5. Let the route run while traffic refreshes automatically every two minutes. A slow or heavy result should show a route-based ECO advisory. Existing downhill and braking rules remain separately demonstrable in the n8n co-driver.
6. Keep the JSONL and CSV export buttons as the offline evidence backup.

The EV, vehicle state, battery use, energy recovery, and route progress are simulated. Map routes and traffic require internet and an active Maps key. No ChatGPT session or hosted dashboard is needed.

## Fully offline mode

The tested evaluator is deterministic and runs inside local n8n. RAG is not configured in this workflow. The Google route and traffic features require internet access.

If the workflow later includes an AI/RAG node, it is fully offline only when its embeddings, vector store, and model are also local (for example, a local document store and local model runtime). Otherwise, disable that cloud-dependent branch for the presentation; the rule-based safety fallback remains available and labels itself as such.
