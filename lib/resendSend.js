const { buildFromHeader } = require('./mailFrom');

function isResendEnabled() {
  return Boolean(String(process.env.RESEND_API_KEY || '').trim());
}

function nodemailerAttachmentsToResend(attachments) {
  if (!attachments?.length) return undefined;
  return attachments.map((a) => {
    const buf = Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content ?? '', 'utf8');
    const out = {
      filename: a.filename || 'attachment',
      content: buf.toString('base64'),
    };
    if (a.cid) {
      out.content_id = String(a.cid).replace(/[<>]/g, '');
    }
    return out;
  });
}

/**
 * Envío por API HTTPS (Railway Hobby bloquea SMTP saliente).
 * @param {{ subject: string, html: string, to: string[], bcc?: string[], attachments?: object[] }} opts
 */
async function sendViaResend(opts) {
  const key = String(process.env.RESEND_API_KEY || '').trim();
  let from = String(process.env.RESEND_FROM || '').trim();
  if (!from) {
    from = buildFromHeader();
  }
  const body = {
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.bcc?.length) {
    body.bcc = opts.bcc;
  }
  const ra = nodemailerAttachmentsToResend(opts.attachments);
  if (ra?.length) {
    body.attachments = ra;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) {
    let detail = txt.slice(0, 2000);
    try {
      const j = JSON.parse(txt);
      if (typeof j.message === 'string') detail = j.message;
    } catch (_) {
      /* cuerpo no JSON */
    }
    throw new Error(detail || `Resend HTTP ${res.status}`);
  }
  return txt ? JSON.parse(txt) : {};
}

module.exports = { isResendEnabled, sendViaResend };
