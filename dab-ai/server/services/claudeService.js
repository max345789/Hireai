const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-sonnet-4-20250514';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const AGENT_SYSTEM_PROMPT = `You are an elite AI real estate agent working 24/7. You are warm,
professional, and extremely efficient.

YOUR CAPABILITIES:
• Qualify leads (budget, timeline, location, property type)
• Answer property questions with expertise
• Schedule viewings diplomatically
• Follow up persistently but not annoyingly
• Detect sentiment - angry clients go to human immediately
• Speak in the client's language automatically

QUALIFICATION QUESTIONS (ask naturally, one at a time):
1. What type of property are you looking for? (apartment/villa/commercial)
2. What is your budget range?
3. What areas are you interested in?
4. What is your timeline? (buying now / in 3 months / just browsing)
5. Is this for personal use or investment?

RESPONSE RULES:
• Max 2-3 sentences per reply
• Never mention you are AI unless directly asked
• If asked if you are AI, say "I'm a digital assistant for [Agency Name]"
• Always end with a soft question to keep conversation going
• If client wants to book - collect: preferred date, preferred time, property address
• Channel style:
  - WhatsApp: under 100 words, short lines, compact
  - Email: up to 200 words, formal tone with greeting/sign-off
  - Web chat: conversational medium length

YOU MUST ALWAYS RESPOND IN THIS EXACT JSON FORMAT:
{
  "action": "reply | qualify | book_viewing | escalate | followup",
  "message": "Your response message to send to client",
  "leadUpdate": {
    "status": "new | qualified | booked | closed | escalated",
    "budget": "extracted budget or null",
    "timeline": "extracted timeline or null",
    "propertyType": "extracted type or null",
    "location": "extracted location or null",
    "sentiment": "positive | neutral | negative"
  },
  "bookingDetails": {
    "requested": true/false,
    "preferredDate": "date or null",
    "preferredTime": "time or null"
  },
  "activityLog": "Short description of what you did - shown in activity feed",
  "escalationReason": "Reason if escalating, otherwise null"
}`;

const ACTIONS = new Set(['reply', 'qualify', 'book_viewing', 'escalate', 'followup', 'close']);
const STATUSES = new Set(['new', 'qualified', 'booked', 'closed', 'escalated']);
const SENTIMENTS = new Set(['positive', 'neutral', 'negative']);

let anthropicClient;

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  return anthropicClient;
}

function getConfiguredAiModels() {
  const requested = String(process.env.AI_MODEL_CHAIN || 'claude,openai,gemini')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const unique = [...new Set(requested)];

  const models = [];
  for (const provider of unique) {
    if (provider === 'claude' && process.env.ANTHROPIC_API_KEY) {
      models.push({ provider: 'claude', model: process.env.CLAUDE_MODEL || MODEL });
    }

    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      models.push({ provider: 'openai', model: OPENAI_MODEL });
    }

    if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      models.push({ provider: 'gemini', model: GEMINI_MODEL });
    }
  }

  return models;
}

function extractBudget(text) {
  if (!text) return null;
  const match = text.match(/\$\s?\d[\d,]*(?:\.\d+)?(?:\s?[kKmM])?/);
  return match ? match[0].replace(/\s+/g, '') : null;
}

function extractTimeline(text) {
  if (!text) return null;
  const match = text.match(/(immediately|asap|now|\d+\s*(day|days|week|weeks|month|months)|next\s+month|this\s+month|just browsing)/i);
  return match ? match[0] : null;
}

function extractPropertyType(text) {
  if (!text) return null;
  const match = text.match(/(apartment|villa|commercial|office|plot|house|2 bedroom|3 bedroom|2bhk|3bhk)/i);
  return match ? match[0] : null;
}

function extractLocation(text) {
  if (!text) return null;
  const match = text.match(/(?:in|near|around)\s+([a-zA-Z\s]{2,30})/i);
  return match ? match[1].trim() : null;
}

function extractDate(text) {
  if (!text) return null;
  const match = text.match(/(tomorrow|today|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  return match ? match[0] : null;
}

function extractTime(text) {
  if (!text) return null;
  const match = text.match(/(\d{1,2}(:\d{2})?\s?(am|pm)|morning|afternoon|evening)/i);
  return match ? match[0] : null;
}

function channelStyleHint(channel) {
  if (channel === 'email') {
    return 'Email mode: formal, up to 200 words, include greeting and sign-off.';
  }

  if (channel === 'whatsapp' || channel === 'sms') {
    return 'WhatsApp/SMS mode: keep under 100 words, short lines, compact and clear.';
  }

  return 'Web chat mode: conversational medium length and friendly.';
}

function applyChannelFallbackStyle(channel, message, agencyName = 'the agency') {
  if (!message) return message;

  if (channel === 'email') {
    return `Hello,\n\n${message}\n\nBest regards,\n${agencyName} Digital Assistant`;
  }

  if (channel === 'whatsapp' || channel === 'sms') {
    return message.split('. ').join('.\n').slice(0, 580);
  }

  return message;
}

function fallbackDecision(context) {
  const channel = context?.channel || context?.lead?.channel || 'web';
  const agencyName = context?.agencyName || 'DAB AI';
  const message = (context?.currentMessage || '').trim();
  const text = message.toLowerCase();

  const sentiment = /(angry|frustrated|terrible|awful|complaint|lawyer|refund|sue)/.test(text)
    ? 'negative'
    : /(great|thanks|perfect|good)/.test(text)
      ? 'positive'
      : 'neutral';

  if (sentiment === 'negative') {
    return {
      action: 'escalate',
      message: applyChannelFallbackStyle(
        channel,
        'I understand your concern and I am connecting you with a senior human agent right now. Could you share the best number to reach you immediately?',
        agencyName
      ),
      leadUpdate: {
        status: 'escalated',
        budget: extractBudget(message),
        timeline: extractTimeline(message),
        propertyType: extractPropertyType(message),
        location: extractLocation(message),
        sentiment,
      },
      bookingDetails: {
        requested: false,
        preferredDate: null,
        preferredTime: null,
      },
      activityLog: `Escalated ${context?.lead?.name || 'lead'} due to negative sentiment`,
      escalationReason: 'Client showed negative sentiment and requires human support.',
      source: 'fallback',
    };
  }

  if (/(book|schedule|viewing|visit|tour)/.test(text)) {
    return {
      action: 'book_viewing',
      message: applyChannelFallbackStyle(
        channel,
        'Great, I can help schedule this viewing. What date and time work best for you, and which property address should I lock in?',
        agencyName
      ),
      leadUpdate: {
        status: 'booked',
        budget: extractBudget(message),
        timeline: extractTimeline(message),
        propertyType: extractPropertyType(message),
        location: extractLocation(message),
        sentiment,
      },
      bookingDetails: {
        requested: true,
        preferredDate: extractDate(message),
        preferredTime: extractTime(message),
      },
      activityLog: `Started booking flow for ${context?.lead?.name || 'lead'}`,
      escalationReason: null,
      source: 'fallback',
    };
  }

  const budget = extractBudget(message);
  const location = extractLocation(message);
  const propertyType = extractPropertyType(message);
  const timeline = extractTimeline(message);

  const mergedSignals = {
    budget: budget || context?.lead?.budget || null,
    location: location || context?.lead?.location || null,
    propertyType: propertyType || context?.lead?.propertyType || null,
    timeline: timeline || context?.lead?.timeline || null,
  };

  const qualifiedSignalCount = Object.values(mergedSignals).filter(Boolean).length;
  const qualified = qualifiedSignalCount >= 2;

  return {
    action: qualified ? 'qualify' : 'reply',
    message: applyChannelFallbackStyle(
      channel,
      qualified
        ? 'Thanks, that helps a lot. Are you buying for personal use or as an investment so I can shortlist the best options?'
        : 'Happy to help you find the right property. What type are you looking for and what budget range should I target?',
      agencyName
    ),
    leadUpdate: {
      status: qualified ? 'qualified' : 'new',
      budget: mergedSignals.budget,
      timeline: mergedSignals.timeline,
      propertyType: mergedSignals.propertyType,
      location: mergedSignals.location,
      sentiment,
    },
    bookingDetails: {
      requested: false,
      preferredDate: null,
      preferredTime: null,
    },
    activityLog: qualified
      ? `Qualified ${context?.lead?.name || 'lead'} with new lead details`
      : `Replied to ${context?.lead?.name || 'lead'} and started qualification`,
    escalationReason: null,
    source: 'fallback',
  };
}

function extractJson(text) {
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

function validateAndNormalizeDecision(raw, context, source = 'ai') {
  if (!raw || typeof raw !== 'object') return null;

  const action = ACTIONS.has(raw.action) ? raw.action : null;
  const message = typeof raw.message === 'string' && raw.message.trim() ? raw.message.trim() : null;
  const leadUpdate = raw.leadUpdate && typeof raw.leadUpdate === 'object' ? raw.leadUpdate : null;
  const bookingDetails = raw.bookingDetails && typeof raw.bookingDetails === 'object' ? raw.bookingDetails : null;

  if (!action || !message || !leadUpdate || !bookingDetails) return null;

  const normalizedStatus = STATUSES.has(leadUpdate.status) ? leadUpdate.status : null;
  const sentiment = SENTIMENTS.has(leadUpdate.sentiment) ? leadUpdate.sentiment : 'neutral';

  if (!normalizedStatus) return null;

  return {
    action,
    message,
    leadUpdate: {
      status: normalizedStatus,
      budget: typeof leadUpdate.budget === 'string' && leadUpdate.budget.trim() ? leadUpdate.budget.trim() : null,
      timeline: typeof leadUpdate.timeline === 'string' && leadUpdate.timeline.trim() ? leadUpdate.timeline.trim() : null,
      propertyType: typeof leadUpdate.propertyType === 'string' && leadUpdate.propertyType.trim() ? leadUpdate.propertyType.trim() : null,
      location: typeof leadUpdate.location === 'string' && leadUpdate.location.trim() ? leadUpdate.location.trim() : null,
      sentiment,
    },
    bookingDetails: {
      requested: Boolean(bookingDetails.requested),
      preferredDate:
        typeof bookingDetails.preferredDate === 'string' && bookingDetails.preferredDate.trim()
          ? bookingDetails.preferredDate.trim()
          : null,
      preferredTime:
        typeof bookingDetails.preferredTime === 'string' && bookingDetails.preferredTime.trim()
          ? bookingDetails.preferredTime.trim()
          : null,
    },
    activityLog:
      typeof raw.activityLog === 'string' && raw.activityLog.trim()
        ? raw.activityLog.trim()
        : `Processed ${context?.lead?.name || 'lead'} message`,
    escalationReason:
      typeof raw.escalationReason === 'string' && raw.escalationReason.trim()
        ? raw.escalationReason.trim()
        : null,
    source,
  };
}

function buildUserPrompt(context, strict) {
  return `You are deciding the next best real-estate-sales action.\n\nContext JSON:\n${JSON.stringify(
    context
  )}\n\n${channelStyleHint(context?.channel)}\n\nReturn only a single valid JSON object with all required fields. Do not wrap in markdown or code fences.${
    strict
      ? '\nSTRICT MODE: If output is not valid raw JSON matching the schema exactly, the request fails.'
      : ''
  }`;
}

async function requestClaudeDecision(context, strictMode, modelName) {
  const client = getAnthropicClient();
  if (!client) return null;

  const completion = await client.messages.create({
    model: modelName || MODEL,
    max_tokens: 700,
    temperature: 0.2,
    system: AGENT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(context, strictMode) }],
  });

  const text = (completion.content || [])
    .filter((piece) => piece.type === 'text')
    .map((piece) => piece.text)
    .join('\n');

  return extractJson(text);
}

async function requestOpenAiDecision(context, strictMode, modelName) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelName || OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: AGENT_SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(context, strictMode) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return extractJson(text);
}

async function requestGeminiDecision(context, strictMode, modelName) {
  const model = modelName || GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: AGENT_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: buildUserPrompt(context, strictMode) }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('\n') || '';
  return extractJson(text);
}

async function requestDecisionFromProvider(providerConfig, context, strictMode) {
  if (providerConfig.provider === 'claude') {
    return requestClaudeDecision(context, strictMode, providerConfig.model);
  }

  if (providerConfig.provider === 'openai') {
    return requestOpenAiDecision(context, strictMode, providerConfig.model);
  }

  if (providerConfig.provider === 'gemini') {
    return requestGeminiDecision(context, strictMode, providerConfig.model);
  }

  return null;
}

async function getAgentDecision(context) {
  const models = getConfiguredAiModels();

  if (!models.length) {
    return fallbackDecision(context);
  }

  for (const providerConfig of models) {
    try {
      const first = await requestDecisionFromProvider(providerConfig, context, false);
      const normalizedFirst = validateAndNormalizeDecision(first, context, providerConfig.provider);
      if (normalizedFirst) return normalizedFirst;

      const second = await requestDecisionFromProvider(providerConfig, context, true);
      const normalizedSecond = validateAndNormalizeDecision(second, context, providerConfig.provider);
      if (normalizedSecond) return normalizedSecond;
    } catch (error) {
      console.error(`${providerConfig.provider} API failed:`, error.message);
    }
  }

  const fallback = fallbackDecision(context);
  fallback.activityLog = `AI providers unavailable, handled ${context?.lead?.name || 'lead'} via resilient fallback mode`;
  return fallback;
}

module.exports = {
  MODEL,
  AGENT_SYSTEM_PROMPT,
  getAgentDecision,
  getConfiguredAiModels,
};
