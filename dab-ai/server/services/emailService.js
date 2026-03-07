const nodemailer = require('nodemailer');
const { env } = require('../config/env');

function getAuthPassword() {
  return process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD || null;
}

function resolveSmtpOptions(options = {}) {
  return {
    smtpUser: options.smtpUser || process.env.GMAIL_USER || null,
    smtpPass: options.smtpPass || getAuthPassword(),
  };
}

function isConfigured(options = {}) {
  const cfg = resolveSmtpOptions(options);
  return Boolean(cfg.smtpUser && cfg.smtpPass);
}

function getTransport(options = {}) {
  const cfg = resolveSmtpOptions(options);
  if (!isConfigured(cfg)) return null;

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: cfg.smtpUser,
      pass: cfg.smtpPass,
    },
  });
}

function buildTemplate(agencyName, agencyLogo, content) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
      .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; }
      .header { background: #6C63FF; padding: 20px; color: white; display: flex; align-items: center; gap: 12px; }
      .logo { width: 38px; height: 38px; border-radius: 8px; object-fit: cover; }
      .body { padding: 30px; line-height: 1.6; color: #222; }
      .footer { padding: 20px; color: #999; font-size: 12px; text-align: center; border-top: 1px solid #eee; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        ${agencyLogo ? `<img class="logo" src="${agencyLogo}" alt="logo" />` : ''}
        <h2 style="margin:0;">${agencyName}</h2>
      </div>
      <div class="body">${content}</div>
      <div class="footer">
        This is an automated message. Reply to this email to continue conversation.
      </div>
    </div>
  </body>
  </html>
  `;
}

function cleanInboundEmailContent(input) {
  if (!input) return '';

  const text = String(input);

  const onDateCut = text.split(/\nOn\s.+wrote:\n/i)[0];
  const withoutQuoted = onDateCut
    .split('\n')
    .filter((line) => !line.trim().startsWith('>'))
    .join('\n');

  const signatureCut = withoutQuoted
    .split(/\n--\s*\n/)[0]
    .split(/\nSent from my iPhone/i)[0]
    .split(/\nSent from my Android/i)[0];

  return signatureCut.trim();
}

async function send(to, subject, htmlBody, textBody, options = {}) {
  const smtp = resolveSmtpOptions(options);
  const transport = getTransport(smtp);
  const agencyName = options.agencyName || 'DAB AI';
  const agencyLogo = options.agencyLogo || null;
  const recipient = String(to || '').trim().toLowerCase();
  const emailSubject = String(subject || 'Property Inquiry').trim().slice(0, 180);
  const plainText = String(textBody || htmlBody || '').trim();
  const html = buildTemplate(agencyName, agencyLogo, htmlBody || textBody || '');

  if (!recipient) {
    return {
      mocked: true,
      success: false,
      sid: null,
      channel: 'email',
      to: null,
      subject: emailSubject,
      error: 'Missing recipient email address',
    };
  }

  if (!transport) {
    if (!env.allowMockDelivery) {
      return {
        mocked: false,
        success: false,
        sid: null,
        channel: 'email',
        to: recipient,
        subject: emailSubject,
        error: 'Gmail SMTP is not configured',
      };
    }

    return {
      mocked: true,
      success: true,
      sid: null,
      channel: 'email',
      to: recipient,
      subject: emailSubject,
      html,
      text: plainText,
    };
  }

  try {
    const info = await transport.sendMail({
      from: smtp.smtpUser,
      to: recipient,
      subject: emailSubject,
      html,
      text: plainText,
    });

    return {
      mocked: false,
      success: true,
      sid: info.messageId,
      channel: 'email',
      to: recipient,
      subject: emailSubject,
      raw: info,
    };
  } catch (error) {
    return {
      mocked: false,
      success: false,
      sid: null,
      channel: 'email',
      to: recipient,
      subject: emailSubject,
      error: error.message,
    };
  }
}

function parseInbound(body) {
  const sender = body?.from || body?.sender || body?.From || '';
  const recipient = body?.to || body?.recipient || body?.To || '';
  const fromMatch = String(sender).match(/<([^>]+)>/);
  const toMatch = String(recipient).match(/<([^>]+)>/);
  const from = (fromMatch ? fromMatch[1] : sender).trim().toLowerCase();
  const to = (toMatch ? toMatch[1] : recipient).trim().toLowerCase();
  const subject = body?.subject || body?.Subject || 'Property Inquiry';
  const text = body?.text || body?.stripped_text || body?.body || '';
  const html = body?.html || body?.stripped_html || null;

  return {
    from,
    to,
    subject,
    text,
    html,
    cleanText: cleanInboundEmailContent(text || html || ''),
    channel: 'email',
  };
}

module.exports = {
  isConfigured,
  send,
  parseInbound,
  buildTemplate,
  cleanInboundEmailContent,
};
