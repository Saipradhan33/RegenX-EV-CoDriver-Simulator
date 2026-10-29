# Simulator telemetry → n8n → auditable co-driver data

The simulator now produces append-only JSON Lines (JSONL) records and can optionally POST the same records to an n8n webhook. Collection is observational only: it does not change physics, controls, or vehicle state. Each press of **Start vehicle** opens a fresh session; **Stop vehicle & export** records the final event, stops the simulation, and automatically downloads a JSONL file for RAG plus a human-readable CSV file.

## Event contract

Every event has a `schema_version`, `event_id`, `occurred_at`, `session_id`, simulator version, vehicle profile, event type, and payload. The important event types are:

- `vehicle_started` and `vehicle_stopped`
- `telemetry_sample` — one sample per second
- `drive_mode_changed` and `regen_level_changed`
- `driver_input_source_changed`
- `co_driver_alert_raised` and `co_driver_alert_cleared`
- `simulation_reset`, `regen_demo_started`, and `simulation_state_changed`

`telemetry_sample` includes vehicle state (speed, route position, elevation, grade, SOC, energy, torque, flow, and lane offset), driver controls, selected drive/regen settings, pause state, and any active alert. JSONL export is the reliable fallback when no webhook is configured.

## n8n MVP workflow

1. Add a **Webhook** trigger accepting `POST` requests. Use a path such as `ev-telemetry` and return a simple 200 response.
2. Copy its production URL into **RAG Data Capture** in the simulator and click **Save endpoint**.
3. Add a **Code** node that splits `body.events` into one item per event while preserving `session_id`, `event_id`, and `occurred_at`.
4. Store raw events in a structured source first—Postgres, Supabase, Airtable, Google Sheets, or n8n Data Store. Use `event_id` as the idempotency key.
5. Create a second workflow that builds session summaries: energy consumed/recovered, time in each mode, pedal smoothness, alerts, and driver overrides.

Do not embed every one-second telemetry row into a vector database. Keep raw telemetry queryable as structured time-series evidence. Embed only the curated session summaries and approved knowledge documents (vehicle manuals, safety policy, and model cards).

## Retrieval and audit path

For a question such as “why did the co-driver recommend stronger regeneration?”, first filter raw events by session and time interval. Then retrieve the relevant vehicle-policy/manual passage. The response should cite both:

1. telemetry evidence — e.g. downhill grade, speed, SOC, and selected regen level; and
2. approved knowledge — e.g. the applicable BE 6/Tata behavior rule.

The model should never invent telemetry. If the data is absent, the audit output must say so.

## First curated dataset

Run repeatable scenario sessions and label each session with a small manifest outside the raw telemetry:

- uphill / downhill / level route;
- Eco/Normal/Sport and each regen setting;
- smooth acceleration, aggressive acceleration, late braking, and coasting;
- normal run, lane-departure alert, steep-climb alert, and low-SOC alert.

This creates the initial corpus for analysis and later model training. It also makes demonstrations repeatable.
