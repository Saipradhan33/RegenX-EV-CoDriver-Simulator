# Connection and coach verification

Tested on 29 October 2026 against the local published **NexRegen — Telemetry Receiver** workflow and the V2 simulator served at `http://127.0.0.1:8080/`.

- The simulator used `http://localhost:5678/webhook/ev-telemetry` and displayed **N8N CONNECTED** with a changing evaluated-sample time. n8n showed repeated successful executions at approximately five-second intervals.
- In the live simulator, Sport acceleration produced the n8n rapid-acceleration warning and an ECO + STANDARD button. Applying it changed the simulated settings; the warning cleared when a subsequent normal batch arrived.
- An invalid endpoint displayed **N8N DISCONNECTED**, removed the old n8n decision, and identified events retained only in the local export. Stopping a drive removed its live decision.
- Synthetic batches sent to the published workflow verified normal driving, rapid acceleration, downhill at 60 km/h, high SOC during descent, fresh slow traffic, stale traffic, vehicle-warning precedence, and a batch with no telemetry samples. At 97% SOC during descent, the workflow returned a warning and no settings proposal.
- The live map returned a route for Bhubaneswar Railway Station to KIIT University and showed normal traffic during the test. Slow-traffic logic was checked with a synthetic route context; a live slow-traffic route and the two-minute refresh were not independently verified during this test.

The route's traffic level reflects the returned route segments; it is not a prediction of congestion at the simulated vehicle's exact position. Road grade, SOC and energy flow are simulator outputs, not measurements from the selected road or a real EV. The n8n workflow reports RAG as not configured.

Before a presentation, check the route and its distance: an ambiguous place name can resolve to the wrong city. Use specific addresses including the city. Start the drive, confirm **N8N CONNECTED**, and compare the latest sample time with recent executions. If disconnected, verify the published workflow, production URL and local server. JSONL/CSV session exports retain events that could not be delivered to n8n.
