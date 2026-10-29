# Route coaching in the local n8n workflow

The reviewed evaluator in `n8n-evaluator-v3-reviewed.js` was published to the local **NexRegen — Telemetry Receiver** workflow. It reads `route_context` from the same webhook body as the simulator events. For a fresh SLOW or HEAVY traffic report, it can suggest ECO if the latest vehicle evaluation has no warning. Existing vehicle warnings take priority. Route advice leaves regeneration unchanged.

The coach does not suggest a regeneration change when battery SOC is at least 95% or a high-priority warning is active. The evaluator's existing warning thresholds remain unchanged. These are simulator rules, not validated real-vehicle instructions.

`n8n-workflow-before-connection-fix.json` is a local backup of the workflow before this change. `LOCAL_DEMO.md` explains the published endpoint and presentation checks. The workflow currently marks RAG as not configured.
