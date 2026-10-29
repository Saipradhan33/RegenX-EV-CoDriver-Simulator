
/**
 * AIoT EV CO-DRIVER — TELEMETRY EVALUATOR
 * Version: 3.0
 *
 * n8n Code node:
 * Mode: Run Once for All Items
 *
 * Input:
 * { events: [telemetry_sample, ...] }
 *
 * Output:
 * ONE n8n item containing:
 * ok, status, alerts, warnings, highest_severity,
 * recommendation, evaluations, rag
 */

const CONFIG = {
  harshAcceleration: 2.5,       // m/s^2
  harshDeceleration: -3.0,      // m/s^2
  highAccelerationRate: 8,     // km/h per second
  highSpeedMargin: 5,          // km/h
  lowSOC: 15,                  // %
  criticalSOC: 8,              // %
  highSOC: 95,                 // %
  downhillGrade: -5,          // %
  downhillSpeed: 55,          // km/h
  lowRegenSpeed: 30,          // km/h
  hardCornering: 3.5,         // m/s^2
  aggressiveThrottle: 85,     // %
  hardBrakePedal: 85,         // %

  numericRegenMap: {
    0: "OFF",
    1: "LOW",
    2: "MEDIUM",
    3: "HIGH"
  }
};

const VERSION = "3.0";
const evaluatedAt = new Date().toISOString();

function numberOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstNumber(...values) {
  for (const value of values) {
    const n = numberOrNull(value);
    if (n !== null) return n;
  }
  return null;
}

function parseJSON(value) {
  if (typeof value !== "string") return value ?? {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function normalizeRegen(value) {
  if (value === undefined || value === null || value === "") {
    return "UNKNOWN";
  }

  if (
    typeof value === "number" ||
    (typeof value === "string" && /^\d+$/.test(value.trim()))
  ) {
    return CONFIG.numericRegenMap[Number(value)] ?? "UNKNOWN";
  }

  const key = String(value)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  const aliases = {
    OFF: "OFF",
    DISABLED: "OFF",
    NONE: "OFF",
    ZERO: "OFF",
    NO_REGEN: "OFF",
    REGEN_OFF: "OFF",

    LOW: "LOW",
    LOW_REGEN: "LOW",
    REGEN_LOW: "LOW",

    STANDARD: "MEDIUM",
    MEDIUM: "MEDIUM",
    MID: "MEDIUM",
    MODERATE: "MEDIUM",
    MED: "MEDIUM",
    REGEN_MEDIUM: "MEDIUM",

    STRONG: "HIGH",
    HIGH: "HIGH",
    HIGH_REGEN: "HIGH",
    REGEN_HIGH: "HIGH",
    MAX: "HIGH",
    MAXIMUM: "HIGH"
  };

  return aliases[key] ?? "UNKNOWN";
}

// Extract telemetry from a webhook body, nested body,
// individual event, or a batch of events.
function extractEvents(item) {
  let data = parseJSON(item.json ?? item);

  for (let i = 0; i < 3 && data?.body !== undefined; i++) {
    data = parseJSON(data.body);
  }

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.events)) return data.events;
  if (data?.event_type) return [data];
  if (data?.payload?.event_type) return [data.payload];

  return [];
}

const inputItems = $input.all();
const events = inputItems.flatMap(extractEvents);

// Process all events in one execution.
// Store previous speed within this batch to estimate
// acceleration when the simulator omits it.
const previousBySession = new Map();

const priorityRank = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3
};

function evaluateEvent(event) {
  const payload = event.payload ?? {};

  const vehicle = payload.vehicle ?? {};
  const driver =
    payload.driver_input ??
    payload.driver_inputs ??
    {};

  const settings =
    payload.vehicle_settings ??
    payload.settings ??
    {};

  const speed = firstNumber(
    vehicle.speed_kph,
    payload.speed_kph
  );

  const grade = firstNumber(
    vehicle.road_grade_percent,
    payload.road_grade_percent,
    payload.grade_percent
  );

  const soc = firstNumber(
    vehicle.battery_soc_percent,
    payload.battery_soc_percent,
    payload.soc_percent
  );

  const throttle = firstNumber(
    driver.throttle_percent,
    vehicle.throttle_percent,
    payload.throttle_percent
  );

  const brake = firstNumber(
    driver.brake_percent,
    driver.brake_pressure_percent,
    vehicle.brake_percent,
    payload.brake_percent
  );

  const regenRaw =
    settings.regen_level ??
    settings.regeneration_level ??
    settings.regen_mode ??
    vehicle.regen_level ??
    payload.regen_level ??
    null;

  const regen = normalizeRegen(regenRaw);

  const explicitAccel = firstNumber(
    vehicle.longitudinal_accel_mps2,
    vehicle.acceleration_mps2,
    payload.acceleration_mps2
  );

  const explicitRate = firstNumber(
    vehicle.speed_change_kph_per_s,
    vehicle.acceleration_kph_per_s,
    payload.speed_change_kph_per_s
  );

  const lateralAccel = firstNumber(
    vehicle.lateral_accel_mps2,
    vehicle.lateral_acceleration_mps2,
    payload.lateral_accel_mps2
  );

  const speedLimit = firstNumber(
    vehicle.speed_limit_kph,
    payload.speed_limit_kph
  );

  const energyFlow = firstNumber(
    vehicle.energy_flow_kw,
    payload.energy_flow_kw
  );

  // Estimate acceleration from consecutive samples
  // belonging to the same simulator session.
  const sessionId = String(event.session_id ?? "default");
  const timestamp = Date.parse(event.occurred_at ?? "");
  const previous = previousBySession.get(sessionId);

  let calculatedAccel = null;
  let calculatedRate = null;

  if (
    previous &&
    Number.isFinite(timestamp) &&
    speed !== null
  ) {
    const dt = (timestamp - previous.time) / 1000;

    if (dt >= 0.2 && dt <= 10) {
      calculatedRate = (speed - previous.speed) / dt;
      calculatedAccel = calculatedRate / 3.6;
    }
  }

  if (Number.isFinite(timestamp) && speed !== null) {
    previousBySession.set(sessionId, {
      time: timestamp,
      speed
    });
  }

  const acceleration =
    explicitAccel ?? calculatedAccel ??
    (explicitRate !== null ? explicitRate / 3.6 : null);

  const accelerationRate =
    explicitRate ?? calculatedRate ??
    (explicitAccel !== null ? explicitAccel * 3.6 : null);

  const metrics = {
    speed_kph: speed,
    road_grade_percent: grade,
    battery_soc_percent: soc,
    throttle_percent: throttle,
    brake_percent: brake,
    regen_level: regen,
    regen_raw: regenRaw,
    acceleration_mps2: acceleration,
    speed_change_kph_per_s: accelerationRate,
    lateral_accel_mps2: lateralAccel,
    speed_limit_kph: speedLimit,
    energy_flow_kw: energyFlow
  };

  const recommendations = [];

  function warn(type, severity, message, action) {
    recommendations.push({
      type,
      code: type.toUpperCase(),
      priority: severity,
      severity,
      message,
      recommended_action: action,
      evidence: { ...metrics }
    });
  }

  // 1. Speed limit checks
  if (speed !== null && speedLimit !== null) {
    if (speed > speedLimit + CONFIG.highSpeedMargin) {
      warn(
        "overspeed_warning",
        "high",
        "Vehicle speed exceeds the configured speed limit.",
        "Reduce speed safely to the permitted limit."
      );
    } else if (speed > speedLimit) {
      warn(
        "speed_limit_warning",
        "medium",
        "Vehicle is travelling above the configured speed limit.",
        "Ease off the accelerator and reduce speed."
      );
    }
  }

  // 2. Harsh acceleration
  if (
    (acceleration !== null &&
      acceleration >= CONFIG.harshAcceleration) ||
    (accelerationRate !== null &&
      accelerationRate >= CONFIG.highAccelerationRate)
  ) {
    warn(
      "harsh_acceleration",
      "medium",
      "Rapid acceleration detected. Energy consumption may increase.",
      "Apply throttle progressively and accelerate smoothly."
    );
  }

  // 3. Harsh braking
  if (
    (acceleration !== null &&
      acceleration <= CONFIG.harshDeceleration) ||
    (brake !== null && brake >= CONFIG.hardBrakePedal)
  ) {
    warn(
      "harsh_braking",
      "high",
      "Hard braking detected.",
      "Respond to hazards first; use smooth braking when safe."
    );
  }

  // 4. Aggressive throttle
  if (
    throttle !== null &&
    throttle >= CONFIG.aggressiveThrottle &&
    speed !== null &&
    speed >= 20
  ) {
    warn(
      "aggressive_throttle",
      "medium",
      "High throttle demand detected at speed.",
      "Reduce unnecessary throttle and maintain smoother acceleration."
    );
  }

  // 5. Downhill regeneration coaching
  if (
    grade !== null &&
    grade <= CONFIG.downhillGrade &&
    speed !== null &&
    speed >= CONFIG.downhillSpeed
  ) {
    if (soc !== null && soc >= CONFIG.highSOC) {
      warn(
        "regen_unavailable_high_soc",
        "high",
        "Battery SOC is high during descent. Regenerative charging may be restricted.",
        "Control speed safely and do not rely on regenerative braking alone."
      );
    } else if (regen === "OFF") {
      warn(
        "regen_disabled_descent",
        "high",
        "Regenerative braking is disabled during a high-speed descent.",
        "Consider suitable regeneration settings without compromising braking safety."
      );
    } else if (regen === "LOW") {
      warn(
        "regen_recommendation",
        "medium",
        "Downhill driving detected with low regeneration.",
        "Consider STANDARD regeneration if the simulator supports it."
      );
    } else if (
      regen === "MEDIUM" ||
      regen === "HIGH"
    ) {
      warn(
        "downhill_monitoring",
        "low",
        "Downhill driving detected with regeneration enabled.",
        "Monitor speed and simulated charging power."
      );
    }
  }

  // 6. Regeneration opportunity while decelerating
  if (
    speed !== null &&
    speed >= CONFIG.lowRegenSpeed &&
    regen === "OFF" &&
    acceleration !== null &&
    acceleration <= -0.8 &&
    (soc === null || soc < CONFIG.highSOC)
  ) {
    warn(
      "regen_opportunity",
      "low",
      "Vehicle is decelerating while regeneration is disabled.",
      "Consider enabling regeneration where appropriate."
    );
  }

  // 7. Battery SOC warnings
  if (soc !== null && soc <= CONFIG.criticalSOC) {
    warn(
      "critical_battery_soc",
      "high",
      "Battery state of charge is critically low.",
      "Reduce unnecessary energy demand and plan to recharge."
    );
  } else if (soc !== null && soc < CONFIG.lowSOC) {
    warn(
      "low_battery_soc",
      "medium",
      "Battery charge is low.",
      "Avoid unnecessary acceleration and monitor remaining range."
    );
  }

  // 8. High-SOC regeneration restriction
  if (
    soc !== null &&
    soc >= CONFIG.highSOC &&
    (regen === "MEDIUM" || regen === "HIGH")
  ) {
    warn(
      "regen_charge_limit",
      "medium",
      "High battery SOC may restrict regenerative charging.",
      "Monitor energy flow and use an appropriate braking strategy."
    );
  }

  // 9. Throttle/brake conflict
  if (
    throttle !== null && throttle >= 25 &&
    brake !== null && brake >= 25
  ) {
    warn(
      "throttle_brake_conflict",
      "medium",
      "Throttle and brake are being applied simultaneously.",
      "Release unnecessary throttle while braking."
    );
  }

  // 10. Hard cornering
  if (
    lateralAccel !== null &&
    Math.abs(lateralAccel) >= CONFIG.hardCornering
  ) {
    warn(
      "hard_cornering",
      "high",
      "High lateral acceleration detected during cornering.",
      "Reduce speed before the turn and steer smoothly."
    );
  }

  // 11. Invalid regeneration setting
  if (regen === "UNKNOWN") {
    warn(
      "regen_status_unknown",
      "low",
      "Regeneration setting is missing or unrecognized.",
      "Check the simulator regeneration configuration."
    );
  }

  recommendations.sort(
    (a, b) =>
      priorityRank[b.priority] -
      priorityRank[a.priority]
  );

  return {
    event_id: event.event_id ?? null,
    session_id: event.session_id ?? null,
    occurred_at: event.occurred_at ?? null,
    evaluated_at: evaluatedAt,
    status: recommendations.length ? "warning" : "normal",
    highest_priority:
      recommendations[0]?.priority ?? "none",
    warning_count: recommendations.length,
    telemetry_quality: {
      speed_available: speed !== null,
      soc_available: soc !== null,
      grade_available: grade !== null,
      throttle_available: throttle !== null,
      brake_available: brake !== null,
      acceleration_available: acceleration !== null,
      speed_limit_available: speedLimit !== null,
      regen_available: regen !== "UNKNOWN"
    },
    metrics,
    recommendations
  };
}

// Remove irrelevant event types.
const telemetryEvents = events.filter(
  event => event?.event_type === "telemetry_sample"
);

// Evaluate in chronological order so acceleration
// calculations use the correct previous sample.
telemetryEvents.sort((a, b) =>
  (Date.parse(a.occurred_at ?? "") || 0) -
  (Date.parse(b.occurred_at ?? "") || 0)
);

const evaluations = telemetryEvents.map(evaluateEvent);
const latest = evaluations[evaluations.length - 1] ?? null;

// HUD alerts should reflect the latest driving state,
// not every historical warning in the batch.
const alerts = (latest?.recommendations ?? []).map(r => ({
  code: r.code,
  type: r.type,
  severity: r.severity,
  priority: r.priority,
  message: r.message,
  recommended_action: r.recommended_action,
  evidence: r.evidence
}));


const eventAlerts = evaluations.flatMap(evaluation =>
  (evaluation.recommendations ?? []).map(r => ({
    event_id: evaluation.event_id,
    occurred_at: evaluation.occurred_at,
    code: r.code,
    severity: r.severity,
    message: r.message,
    recommended_action: r.recommended_action
  }))
);

const batchWarningCount = eventAlerts.length;

const highestSeverity = latest?.highest_priority ?? "none";

const top = alerts[0] ?? null;

const response = {
  ok: telemetryEvents.length > 0,
  schema_version: "2.0.0",
  evaluator_version: VERSION,
  evaluated_at: evaluatedAt,
  
  
batch_warning_count: batchWarningCount,
event_alerts: eventAlerts,


  session_id: latest?.session_id ?? null,
  latest_event_id: latest?.event_id ?? null,
  latest_event_at: latest?.occurred_at ?? null,

  processed_samples: telemetryEvents.length,

  status: latest?.status ?? "no_telemetry",
  highest_severity: highestSeverity,
  highest_priority: highestSeverity,
  warning_count: alerts.length,

  alerts,
  warnings: alerts,

  recommendation: top
    ? {
        message: top.message,
        action: top.recommended_action,
        severity: top.severity
      }
    : null,

  recommendations: latest?.recommendations ?? [],
  latest_metrics: latest?.metrics ?? null,
  evaluations,

  // RAG is intentionally marked unavailable until
  // real retrieval and source validation are connected.
  rag: {
    used: false,
    status: "not_configured",
    sources: []
  }
};/*
 * AI DRIVING COACH POLICY — deterministic and explainable.
 * Advisory only: this proposes simulator settings; the driver must explicitly apply them.
 * It remains local, fast, reproducible, and separate from any future LLM/RAG explanation.
 */
let suggestedSettings = null;
let coachingReason = 'No driving-mode change is currently recommended.';
const code = String(top?.code ?? '').toUpperCase();
const soc = latest?.metrics?.battery_soc_percent;
const highCharge = soc !== null && soc !== undefined && soc >= CONFIG.highSOC;
const highPriority = alerts.some(alert => ['high', 'critical'].includes(String(alert.severity).toLowerCase()));

// Never propose stronger regeneration while charging may be restricted or a
// high-priority safety warning is active. Existing evaluation rules stay intact.
if (highCharge || highPriority) {
  coachingReason = 'Review the current warning; no automatic setting change is proposed.';
} else if (['HARSH_ACCELERATION', 'AGGRESSIVE_THROTTLE', 'LOW_SOC', 'CRITICAL_SOC'].includes(code)) {
  suggestedSettings = { drive_mode: 'ECO', regen_level: 'STANDARD' };
  coachingReason = 'ECO and standard regeneration are suggested for the simulator.';
} else if (code === 'REGEN_RECOMMENDATION') {
  suggestedSettings = { drive_mode: 'ECO', regen_level: 'STANDARD' };
  coachingReason = 'The evaluator recommends standard regeneration on this descent.';
} else if (['DOWNHILL_MONITORING', 'REGEN_OPPORTUNITY'].includes(code) && soc !== null && soc !== undefined) {
  suggestedSettings = { drive_mode: 'ECO', regen_level: 'STRONG' };
  coachingReason = 'Stronger simulated regeneration can be considered when charge is below the configured limit.';
}

// Transparent current-batch indicator; not a long-term driver score.
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

// Route advice supplements the latest vehicle evaluation, without overriding it.
let envelope = parseJSON(inputItems[0]?.json ?? {});
for (let i = 0; i < 3 && envelope?.body !== undefined; i++) envelope = parseJSON(envelope.body);
const routeContext = envelope?.route_context;
const traffic = String(routeContext?.traffic_level ?? '').toUpperCase();
const routeAge = Date.now() - Date.parse(routeContext?.updated_at ?? '');
if (routeContext && typeof routeContext === 'object') response.route_context = routeContext;
if (latest && !top && !highCharge && ['SLOW', 'HEAVY'].includes(traffic) && Number.isFinite(routeAge) && routeAge >= -60000 && routeAge <= 300000) {
  response.recommendation = {
    message: `${traffic === 'HEAVY' ? 'Heavy' : 'Slow'} traffic is reported on the selected route.`,
    action: 'Consider ECO mode for simulated stop-and-go driving.',
    severity: 'medium'
  };
  response.suggested_settings = { drive_mode: 'ECO' };
  response.coach.reason = 'Current route traffic is slow; regeneration is unchanged.';
}


return [{ json: response }];
