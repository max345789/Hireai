function evaluateGuardrails({
  confidence = 0,
  riskFlags = [],
  requiresHuman = false,
  profanity = false,
  leadPaused = false,
  sendFailed = false,
}) {
  const reasons = [];

  if (leadPaused) reasons.push('lead_paused');
  if (requiresHuman) reasons.push('orchestrator_requires_human');
  if (confidence < 0.68) reasons.push('low_confidence');
  if (Array.isArray(riskFlags) && riskFlags.length > 0) reasons.push('risk_flags_present');
  if (profanity) reasons.push('profanity_detected');
  if (sendFailed) reasons.push('delivery_failed');

  return {
    autoSend: reasons.length === 0,
    reasons,
  };
}

module.exports = {
  evaluateGuardrails,
};
