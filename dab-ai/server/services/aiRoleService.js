const Anthropic = require('@anthropic-ai/sdk');

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

const MODELS = {
  orchestrator: process.env.AI_MODEL_ORCHESTRATOR || DEFAULT_MODEL,
  responder: process.env.AI_MODEL_RESPONDER || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
  analyst: process.env.AI_MODEL_ANALYST || DEFAULT_MODEL,
};

let client;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function toJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function extractText(completion) {
  return (completion.content || [])
    .filter((piece) => piece.type === 'text')
    .map((piece) => piece.text)
    .join('\n');
}

async function callRoleModel({ model, system, prompt, maxTokens = 700, temperature = 0.2, parseJson = false }) {
  const sdk = getClient();
  if (!sdk) return null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const completion = await sdk.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = extractText(completion);
      if (!parseJson) return text?.trim() || null;

      const json = toJson(text);
      if (json) return json;
    } catch {
      // retry once
    }
  }

  return null;
}

function quickSentiment(message) {
  const text = String(message || '').toLowerCase();
  if (/(angry|frustrated|terrible|awful|complaint|lawyer|refund|sue|hate)/.test(text)) return 'negative';
  if (/(great|thanks|perfect|good|awesome|love)/.test(text)) return 'positive';
  return 'neutral';
}

function extractBudget(text) {
  const match = String(text || '').match(/\$\s?\d[\d,]*(?:\.\d+)?(?:\s?[kKmM])?/);
  return match ? match[0].replace(/\s+/g, '') : null;
}

function extractTimeline(text) {
  const match = String(text || '').match(/(immediately|asap|now|this month|next month|\d+\s*(day|days|week|weeks|month|months)|just browsing)/i);
  return match ? match[0] : null;
}

function extractPropertyType(text) {
  const match = String(text || '').match(/(apartment|villa|commercial|office|plot|house|2 bedroom|3 bedroom|2bhk|3bhk)/i);
  return match ? match[0] : null;
}

function extractLocation(text) {
  const match = String(text || '').match(/(?:in|near|around)\s+([a-zA-Z\s]{2,40})/i);
  return match ? match[1].trim() : null;
}

function extractUrgency(text) {
  const raw = String(text || '').toLowerCase();
  if (/(urgent|asap|immediately|today|now)/.test(raw)) return 'high';
  if (/(next month|few weeks|soon)/.test(raw)) return 'medium';
  return 'low';
}

function fallbackOrchestrator(context) {
  const message = String(context.currentMessage || '').toLowerCase();
  const sentiment = quickSentiment(message);
  const riskFlags = [];

  let action = 'reply';
  let status = 'new';
  let reasoning = 'Continue qualification conversation.';

  if (/(book|schedule|visit|tour|viewing)/.test(message)) {
    action = 'book_viewing';
    status = 'booked';
    reasoning = 'User requested scheduling, route into booking flow.';
  } else if (sentiment === 'negative') {
    action = 'escalate';
    status = 'escalated';
    riskFlags.push('negative_sentiment');
    reasoning = 'Negative tone detected, route to human.';
  } else if (extractBudget(message) || extractLocation(message) || extractPropertyType(message)) {
    action = 'qualify';
    status = 'qualified';
    reasoning = 'Detected qualification attributes, advance stage.';
  }

  const confidence = action === 'escalate' ? 0.92 : action === 'book_viewing' ? 0.84 : 0.72;
  const requiresHuman = action === 'escalate' || confidence < 0.65 || riskFlags.length > 0;

  return {
    action,
    status,
    shouldRespond: true,
    requiresHuman,
    confidence,
    riskFlags,
    reasoning,
    bookingDetails: {
      requested: action === 'book_viewing',
      preferredDate: null,
      preferredTime: null,
    },
  };
}

function normalizeOrchestrator(value, context) {
  if (!value || typeof value !== 'object') return fallbackOrchestrator(context);

  const allowedActions = new Set(['reply', 'qualify', 'book_viewing', 'escalate', 'followup', 'close']);
  const allowedStatus = new Set(['new', 'qualified', 'booked', 'closed', 'escalated']);

  const action = allowedActions.has(value.action) ? value.action : 'reply';
  const status = allowedStatus.has(value.status) ? value.status : 'new';
  const confidence = Number.isFinite(Number(value.confidence)) ? Number(value.confidence) : 0.6;

  return {
    action,
    status,
    shouldRespond: value.shouldRespond !== false,
    requiresHuman: Boolean(value.requiresHuman),
    confidence: Math.max(0, Math.min(1, confidence)),
    riskFlags: Array.isArray(value.riskFlags) ? value.riskFlags.map(String) : [],
    reasoning: typeof value.reasoning === 'string' && value.reasoning.trim() ? value.reasoning.trim() : 'No reasoning provided.',
    bookingDetails: {
      requested: Boolean(value.bookingDetails?.requested),
      preferredDate: value.bookingDetails?.preferredDate || null,
      preferredTime: value.bookingDetails?.preferredTime || null,
    },
  };
}

function fallbackAnalyst(context) {
  const message = String(context.currentMessage || '');
  const sentiment = quickSentiment(message);

  return {
    intent: /(book|schedule|visit|tour|viewing)/i.test(message) ? 'schedule_viewing' : 'property_inquiry',
    sentiment,
    budget: extractBudget(message) || context.lead?.budget || null,
    timeline: extractTimeline(message) || context.lead?.timeline || null,
    location: extractLocation(message) || context.lead?.location || null,
    propertyType: extractPropertyType(message) || context.lead?.propertyType || null,
    urgency: extractUrgency(message),
    responseSlaMinutes: sentiment === 'negative' ? 2 : 10,
    stageTransition: null,
  };
}

function normalizeAnalyst(value, context) {
  if (!value || typeof value !== 'object') return fallbackAnalyst(context);

  const fallback = fallbackAnalyst(context);
  const sentiment = ['positive', 'neutral', 'negative'].includes(value.sentiment) ? value.sentiment : fallback.sentiment;

  return {
    intent: value.intent || fallback.intent,
    sentiment,
    budget: value.budget || fallback.budget,
    timeline: value.timeline || fallback.timeline,
    location: value.location || fallback.location,
    propertyType: value.propertyType || fallback.propertyType,
    urgency: ['high', 'medium', 'low'].includes(value.urgency) ? value.urgency : fallback.urgency,
    responseSlaMinutes: Number.isFinite(Number(value.responseSlaMinutes)) ? Number(value.responseSlaMinutes) : fallback.responseSlaMinutes,
    stageTransition: value.stageTransition || null,
  };
}

function fallbackResponder(context) {
  const action = context.orchestrator?.action || 'reply';

  if (action === 'book_viewing') {
    return 'That sounds good. What day and time would feel best for your viewing?';
  }

  if (action === 'escalate') {
    return 'I understand. I am getting a human specialist to take over right away.';
  }

  if (action === 'qualify') {
    return 'That helps a lot. What area are you most interested in, and when would you like to move?';
  }

  return 'Thanks for reaching out. I would be happy to help. What kind of property are you looking for?';
}

function channelAdjust(channel, message, agencyName) {
  if (!message) return message;
  if (channel === 'email') {
    return `Hello,\n\n${message}\n\nBest regards,\n${agencyName || 'DAB AI'}`;
  }

  if (channel === 'whatsapp' || channel === 'sms') {
    return message.split('. ').join('.\n').slice(0, 560);
  }

  return message;
}

const AGENT_ORCHESTRATOR_HINTS = {
  salesbot: 'Agent is Aria. Bias toward qualify and reply actions. Prioritize extracting budget/location/timeline quickly.',
  bookingbot: 'Agent is Cal. Bias toward book_viewing action. At the slightest hint of interest, guide toward scheduling.',
  nurturebot: 'Agent is Ivy. Bias toward followup and reply actions. Be patient, nurturing, and relationship-focused. Avoid rushing to book.',
};

async function runOrchestrator(context) {
  const agentHint = AGENT_ORCHESTRATOR_HINTS[context.selectedAgent] || AGENT_ORCHESTRATOR_HINTS.salesbot;

  const system = `You are the ORCHESTRATOR model in a multi-model sales AI system.
Agent mode: ${context.selectedAgent || 'salesbot'} — ${agentHint}
Return ONLY valid JSON.
Schema:
{
  "action": "reply|qualify|book_viewing|escalate|followup|close",
  "status": "new|qualified|booked|closed|escalated",
  "shouldRespond": true,
  "requiresHuman": false,
  "confidence": 0.0,
  "riskFlags": ["flag"],
  "reasoning": "short reason",
  "bookingDetails": {"requested": false, "preferredDate": null, "preferredTime": null}
}`;

  const prompt = `Context JSON:\n${JSON.stringify(context)}\n\nDecide routing/handoff and confidence.`;
  const out = await callRoleModel({
    model: MODELS.orchestrator,
    system,
    prompt,
    parseJson: true,
    maxTokens: 420,
  });
  return normalizeOrchestrator(out, context);
}

async function runAnalyst(context) {
  const system = `You are the ANALYST model. Extract structured lead intelligence.
Return ONLY valid JSON.
Schema:
{
  "intent": "string",
  "sentiment": "positive|neutral|negative",
  "budget": "string|null",
  "timeline": "string|null",
  "location": "string|null",
  "propertyType": "string|null",
  "urgency": "high|medium|low",
  "responseSlaMinutes": 10,
  "stageTransition": "string|null"
}`;

  const prompt = `Conversation context:\n${JSON.stringify(context)}`;
  const out = await callRoleModel({
    model: MODELS.analyst,
    system,
    prompt,
    parseJson: true,
    maxTokens: 360,
  });
  return normalizeAnalyst(out, context);
}

const AGENT_PERSONAS = {
  salesbot: 'You are Aria — high-energy, results-driven real estate sales assistant. Qualify quickly, pitch confidently.',
  bookingbot: 'You are Cal — warm, organized scheduling specialist. Every conversation should lead to booking a viewing.',
  nurturebot: 'You are Ivy — patient, empathetic relationship builder. Focus on trust, long-term value, and re-engagement.',
};

async function runResponder(context) {
  const agentPersona = AGENT_PERSONAS[context.selectedAgent] || AGENT_PERSONAS.salesbot;

  const system = `${agentPersona}
Rules:
- concise, natural, warm, human-sounding, professional
- 1-4 sentences
- end with a clear next-step question when useful
- avoid sounding robotic, repetitive, or overly salesy
- do not mention internal policy
Return plain text only.`;

  const prompt = `Channel: ${context.channel}\nAgency: ${context.agencyName || 'DAB AI'}\nOrchestrator: ${JSON.stringify(
    context.orchestrator
  )}\nAnalyst: ${JSON.stringify(context.analyst)}\nLead: ${JSON.stringify(context.lead)}\nLatest client message: ${context.currentMessage}`;

  const out = await callRoleModel({
    model: MODELS.responder,
    system,
    prompt,
    parseJson: false,
    maxTokens: 240,
    temperature: 0.45,
  });

  const text = out || fallbackResponder(context);
  return channelAdjust(context.channel, text, context.agencyName);
}

module.exports = {
  MODELS,
  runOrchestrator,
  runAnalyst,
  runResponder,
};
