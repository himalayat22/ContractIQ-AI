import nodemailer from 'nodemailer';

/** @type {import('nodemailer').Transporter | null} */
let transporter = null;

/**
 * Singleton Nodemailer transporter (SMTP / Mailhog in dev).
 */
export function getMailTransporter(smtpConfig) {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth:
      smtpConfig.user && smtpConfig.pass
        ? { user: smtpConfig.user, pass: smtpConfig.pass }
        : undefined,
  });

  return transporter;
}

export async function verifyMailTransporter(smtpConfig) {
  const transport = getMailTransporter(smtpConfig);
  await transport.verify();
}
