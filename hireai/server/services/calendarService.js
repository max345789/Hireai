const { google } = require('googleapis');

/**
 * Google Calendar Service
 * Gracefully degrades when credentials are not configured.
 * calendarConfig stored in DB is a JSON string containing:
 *   { clientId, clientSecret, redirectUri, tokens: { access_token, refresh_token } }
 */

function getOAuth2Client(calendarConfig) {
  if (!calendarConfig) return null;

  let config;
  try {
    config = typeof calendarConfig === 'string' ? JSON.parse(calendarConfig) : calendarConfig;
  } catch {
    return null;
  }

  if (!config.clientId || !config.clientSecret) return null;

  const oauth2 = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri || 'http://localhost:3001/api/calendar/oauth/callback'
  );

  if (config.tokens) {
    oauth2.setCredentials(config.tokens);
  }

  return { oauth2, config };
}

/**
 * Generate OAuth2 authorization URL for agency to connect Google Calendar
 */
function getAuthUrl(calendarConfig) {
  const result = getOAuth2Client(calendarConfig);
  if (!result) return null;

  const { oauth2 } = result;
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    prompt: 'consent',
  });
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCode(calendarConfig, code) {
  const result = getOAuth2Client(calendarConfig);
  if (!result) throw new Error('Calendar not configured');

  const { oauth2, config } = result;
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  return JSON.stringify({ ...config, tokens });
}

/**
 * List available time slots for next N days
 * Returns array of { start, end } ISO strings
 */
async function getAvailableSlots(calendarConfig, days = 7) {
  const result = getOAuth2Client(calendarConfig);
  if (!result || !result.config.tokens) {
    return generateDefaultSlots(days);
  }

  try {
    const { oauth2 } = result;
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });

    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const busyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        items: [{ id: 'primary' }],
      },
    });

    const busy = (busyResponse.data.calendars?.primary?.busy || []).map((slot) => ({
      start: new Date(slot.start),
      end: new Date(slot.end),
    }));

    return generateSlots(now, future, busy);
  } catch (error) {
    console.error('Calendar freebusy failed:', error.message);
    return generateDefaultSlots(days);
  }
}

function generateDefaultSlots(days = 7) {
  const slots = [];
  const now = new Date();

  for (let d = 1; d <= days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);

    if (date.getDay() === 0 || date.getDay() === 6) continue;

    for (const hour of [9, 10, 11, 14, 15, 16]) {
      const start = new Date(date);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start);
      end.setHours(hour + 1, 0, 0, 0);
      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: `${start.toDateString()} at ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      });
    }
  }

  return slots.slice(0, 12);
}

function generateSlots(from, to, busy) {
  const slots = [];
  const cursor = new Date(from);
  cursor.setMinutes(0, 0, 0);
  cursor.setHours(cursor.getHours() + 1);

  while (cursor < to && slots.length < 12) {
    const h = cursor.getHours();
    const day = cursor.getDay();

    if (day !== 0 && day !== 6 && h >= 9 && h < 17) {
      const slotEnd = new Date(cursor.getTime() + 60 * 60 * 1000);
      const conflict = busy.some((b) => cursor < b.end && slotEnd > b.start);

      if (!conflict) {
        slots.push({
          start: cursor.toISOString(),
          end: slotEnd.toISOString(),
          label: `${cursor.toDateString()} at ${cursor.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        });
      }
    }

    cursor.setHours(cursor.getHours() + 1);
  }

  return slots;
}

/**
 * Create a calendar event for a booking
 */
async function createEvent(calendarConfig, { summary, description, start, end, attendeeEmail, location }) {
  const result = getOAuth2Client(calendarConfig);

  if (!result || !result.config.tokens) {
    console.log('[Calendar] No tokens — skipping Google Calendar sync');
    return { id: null, htmlLink: null, skipped: true };
  }

  try {
    const { oauth2 } = result;
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });

    const event = {
      summary: summary || 'Property Viewing',
      description: description || '',
      location: location || '',
      start: { dateTime: start, timeZone: 'UTC' },
      end: { dateTime: end || new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString(), timeZone: 'UTC' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    if (attendeeEmail) {
      event.attendees = [{ email: attendeeEmail }];
    }

    const created = await calendar.events.insert({
      calendarId: 'primary',
      sendUpdates: attendeeEmail ? 'all' : 'none',
      requestBody: event,
    });

    return { id: created.data.id, htmlLink: created.data.htmlLink, skipped: false };
  } catch (error) {
    console.error('[Calendar] createEvent failed:', error.message);
    return { id: null, htmlLink: null, skipped: true, error: error.message };
  }
}

/**
 * Delete / cancel a calendar event
 */
async function deleteEvent(calendarConfig, eventId) {
  if (!eventId) return;

  const result = getOAuth2Client(calendarConfig);
  if (!result || !result.config.tokens) return;

  try {
    const { oauth2 } = result;
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });
    await calendar.events.delete({ calendarId: 'primary', eventId });
  } catch (error) {
    console.error('[Calendar] deleteEvent failed:', error.message);
  }
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  getAvailableSlots,
  createEvent,
  deleteEvent,
};
