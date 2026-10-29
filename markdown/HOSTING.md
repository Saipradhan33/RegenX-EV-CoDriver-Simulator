# Hosting the Version 2 simulator

The simulator is a static website. Upload this whole folder to a static host and use its HTTPS address to open `index.html`.

## Before publishing

1. Keep a copy of `n8n-workflow-v2-final.json`. It is the tested local workflow export.
2. In Google Cloud, add the final HTTPS site address to the Maps API key referrer restrictions. The browser API key is entered in the simulator and is not stored in source files.
3. Test a route after publishing. Google Maps is tied to the deployed site address, so a key that works on `127.0.0.1` may be rejected on the hosted address until that address is allowed.

## n8n connection

`http://localhost:5678/webhook/ev-telemetry` works only when the simulator and n8n are on the same laptop. A hosted simulator cannot send telemetry to a visitor's localhost service.

For an online demo, run n8n at a public HTTPS address and place its production webhook URL in the simulator's **n8n webhook URL** field. Configure n8n CORS to allow the hosted site address. Then start a drive and confirm **N8N CONNECTED** and a changing evaluated-sample time.

For the offline presentation on your laptop, serve this folder locally and keep the local production webhook URL. The full setup is in `LOCAL_DEMO.md`.

## Final checks

- Use the production webhook URL, never `/webhook-test/`.
- Enter unambiguous From and To addresses including the city.
- Start a drive and wait for **N8N CONNECTED**.
- Confirm the latest evaluated-sample time changes and n8n records a successful execution.
- Stop the drive to download JSONL and CSV evidence.
