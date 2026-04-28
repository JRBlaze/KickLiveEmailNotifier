const nodemailer = require('nodemailer');

function hasSmtpConfig(settings) {
  const smtp = settings.smtp || {};
  return Boolean(smtp.host && smtp.port && smtp.user && smtp.pass && smtp.from && smtp.to);
}

function canSendEmail(settings) {
  return hasSmtpConfig(settings);
}

function createTransport(settings) {
  const smtp = settings.smtp || {};
  const port = Number(smtp.port || 587);

  return nodemailer.createTransport({
    host: smtp.host,
    port,
    secure: shouldUseSecureConnection(smtp),
    auth: {
      user: smtp.user,
      pass: smtp.pass
    }
  });
}

function shouldUseSecureConnection(smtp) {
  return Number(smtp.port || 587) === 465 ? true : Boolean(smtp.secure);
}

function liveEmail(streamer) {
  const subject = `${streamer.displayName || streamer.slug} is live on Kick`;
  const lines = [
    `${streamer.displayName || streamer.slug} just went live on Kick.`,
    '',
    streamer.title ? `Title: ${streamer.title}` : null,
    streamer.category ? `Category: ${streamer.category}` : null,
    streamer.viewers ? `Viewers: ${streamer.viewers}` : null,
    '',
    streamer.url || `https://kick.com/${streamer.slug}`
  ].filter((line) => line !== null);

  return {
    subject,
    text: lines.join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.45">
        <h2>${escapeHtml(streamer.displayName || streamer.slug)} is live on Kick</h2>
        ${streamer.title ? `<p><strong>Title:</strong> ${escapeHtml(streamer.title)}</p>` : ''}
        ${streamer.category ? `<p><strong>Category:</strong> ${escapeHtml(streamer.category)}</p>` : ''}
        ${streamer.viewers ? `<p><strong>Viewers:</strong> ${streamer.viewers}</p>` : ''}
        <p><a href="${escapeAttribute(streamer.url || `https://kick.com/${streamer.slug}`)}">Watch now</a></p>
      </div>
    `
  };
}

async function sendLiveEmail(settings, streamer) {
  if (!hasSmtpConfig(settings)) {
    throw new Error('SMTP settings are incomplete.');
  }

  const smtp = settings.smtp;
  const transport = createTransport(settings);
  const message = liveEmail(streamer);

  try {
    await transport.sendMail({
      from: smtp.from,
      to: smtp.to,
      subject: message.subject,
      text: message.text,
      html: message.html
    });
  } catch (error) {
    throw normalizeSmtpError(error, smtp);
  }
}

async function testEmail(settings) {
  if (!hasSmtpConfig(settings)) {
    throw new Error('SMTP settings are incomplete.');
  }

  const smtp = settings.smtp;
  const transport = createTransport(settings);

  try {
    await transport.verify();
    await transport.sendMail({
      from: smtp.from,
      to: smtp.to,
      subject: 'Kick Live Email Alerts test',
      text: 'Your Kick Live Email Alerts SMTP settings are working.'
    });
  } catch (error) {
    throw normalizeSmtpError(error, smtp);
  }
}

function normalizeSmtpError(error, smtp) {
  const message = String(error && (error.message || error.reason || error.code) || '');
  const port = Number(smtp.port || 587);

  if (message.includes('WRONG_VERSION_NUMBER')) {
    if (port === 587 || port === 25) {
      return new Error('SMTP security mismatch: port 587 usually needs STARTTLS, so leave "Direct SSL" turned off. Port 465 usually needs Direct SSL turned on.');
    }

    if (port === 465) {
      return new Error('SMTP security mismatch: port 465 usually needs Direct SSL turned on.');
    }

    return new Error('SMTP security mismatch. Try port 587 with Direct SSL off, or port 465 with Direct SSL on.');
  }

  if (error && error.code === 'EAUTH') {
    return new Error('SMTP authentication failed. Check the username and password. Gmail usually requires an app password.');
  }

  return error;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

module.exports = {
  hasSmtpConfig,
  canSendEmail,
  normalizeSmtpError,
  sendLiveEmail,
  testEmail
};
