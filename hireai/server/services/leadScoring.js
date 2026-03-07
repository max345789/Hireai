/**
 * Lead Scoring Service
 * Calculates a 0-100 score based on lead qualification attributes.
 */

function calculateLeadScore(lead) {
  let score = 0;

  // Budget detected (25 pts)
  if (lead.budget) score += 25;

  // Location known (15 pts)
  if (lead.location) score += 15;

  // Property type specified (15 pts)
  if (lead.propertyType) score += 15;

  // Timeline provided (15 pts)
  if (lead.timeline) {
    score += 15;
    // Bonus for urgent timelines
    const tl = String(lead.timeline).toLowerCase();
    if (/(asap|immediately|now|this month|urgent)/.test(tl)) score += 5;
  }

  // Urgency bonus (10 pts max)
  if (lead.urgency === 'high') score += 10;
  else if (lead.urgency === 'medium') score += 5;

  // Sentiment bonus (10 pts max)
  if (lead.sentiment === 'positive') score += 10;
  else if (lead.sentiment === 'negative') score -= 10;

  // Status progression bonus
  if (lead.status === 'qualified') score += 5;
  if (lead.status === 'booked') score += 10;

  return Math.max(0, Math.min(100, score));
}

function scoreLabel(score) {
  if (score >= 75) return 'hot';
  if (score >= 50) return 'warm';
  if (score >= 25) return 'cool';
  return 'cold';
}

function scoreColor(score) {
  if (score >= 75) return '#ef4444'; // red - hot
  if (score >= 50) return '#f97316'; // orange - warm
  if (score >= 25) return '#3b82f6'; // blue - cool
  return '#6b7280'; // gray - cold
}

module.exports = { calculateLeadScore, scoreLabel, scoreColor };
