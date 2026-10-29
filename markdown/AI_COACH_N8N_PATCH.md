# Safe n8n AI Driving Coach upgrade

## What this changes

Your current **Version 3.0** Code node already evaluates simulator batches and returns `alerts`, `warnings`, and a `recommendation` object. Keep every existing rule unchanged.

Insert the following block **immediately before** the existing line:

```javascript
return [{ json: response }];
```

```javascript
/*
 * AI DRIVING COACH POLICY — deterministic and explainable.
 *
 * This does not control a vehicle. It proposes simulator settings and the
 * driver must explicitly press the Apply button in the UI.
 *
 * It is deliberately rule-based so the live telemetry path stays fast,
 * reproducible, and fully local. An LLM/RAG explanation can be added later
 * as a separate, non-critical workflow.
 */
const coachText = [top?.message, top?.recommended_action]
  .filter(value => typeof value === 'string')
  .join(' ')
  .toLowerCase();

let suggestedSettings = null;
let coachingReason = 'No driving-mode change is currently recommended.';

if (/downhill|descent|regen|recovery/.test(coachText)) {
  suggestedSettings = { drive_mode: 'ECO', regen_level: 'STRONG' };
  coachingReason = 'Use stronger regeneration during a downhill or energy-recovery opportunity.';
} else if (/rapid|harsh|aggress|acceler/.test(coachText)) {
  suggestedSettings = { drive_mode: 'ECO', regen_level: 'STANDARD' };
  coachingReason = 'ECO mode reduces aggressive traction demand while keeping predictable regeneration.';
} else if (/battery|charge|range/.test(coachText)) {
  suggestedSettings = { drive_mode: 'ECO', regen_level: 'STANDARD' };
  coachingReason = 'ECO mode is recommended to conserve state of charge.';
} else if (/brak/.test(coachText)) {
  suggestedSettings = { regen_level: 'STRONG' };
  coachingReason = 'Stronger regeneration is recommended for a braking event in the simulation.';
}

// A transparent current-batch indicator; it is not a long-term driver score.
const drivingScore = Math.max(0, 100 - (alerts.length * 10));

response.coach = {
  version: '1.0',
  mode: 'deterministic_policy',
  advisory_only: true,
  requires_driver_confirmation: true,
  reason: coachingReason
};
response.suggested_settings = suggestedSettings;
response.driving_score = {
  score: drivingScore,
  band: drivingScore >= 90 ? 'EFFICIENT' : drivingScore >= 70 ? 'MODERATE' : 'NEEDS_ATTENTION',
  basis: 'Current webhook batch only; no session database is used.'
};
```

Then save the node, execute it with a representative test event, and confirm the response contains `suggested_settings` before publishing.

## Why this is the right first coach

- It keeps existing alert logic unchanged.
- It gives the simulator authoritative n8n settings instead of UI-side inference.
- It works with no database, cloud AI API, ChatGPT, or RAG service.
- It produces auditable reasons for every setting proposal.

## Do not place an AI Agent in the live telemetry path yet

An agent should be an optional **explanation** workflow, triggered by a significant alert or a user request. It must never control driving mode, regeneration hardware, motor torque, or braking. Keep this deterministic coach as the sole source of live setting proposals.
