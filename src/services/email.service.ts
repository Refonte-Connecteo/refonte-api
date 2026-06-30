import nodemailer from 'nodemailer';
import { envConfig } from '@/config/env.config';
import type { ContactInput } from '@/schemas/contact.schema';

function buildHtmlMessage(data: ContactInput): string {
  const fields = [
    { label: 'Prénom', value: data.first_name },
    { label: 'Nom', value: data.last_name },
    { label: 'Email', value: data.email },
    { label: 'Téléphone', value: data.phone || 'Non renseigné' },
    { label: 'Société', value: data.company || 'Non renseigné' },
    { label: 'Pays', value: data.country || 'Non renseigné' },
    { label: 'Message', value: data.message },
  ];

  const rows = fields
    .map(
      (f) =>
        `<tr><td style="padding:8px 12px;font-weight:600;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top">${f.label}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${f.value.replace(/\n/g, '<br>')}</td></tr>`,
    )
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1a1a2e">Nouveau message de contact</h2>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <p style="color:#888;font-size:12px;margin-top:24px">
        Cet email a été envoyé depuis le formulaire de contact de Connecteo.
      </p>
    </div>
  `;
}

export async function sendContactEmail(data: ContactInput): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: envConfig.email.smtpHost,
    port: envConfig.email.smtpPort,
    secure: envConfig.email.smtpSecure,
    auth: {
      user: envConfig.email.smtpUser,
      pass: envConfig.email.smtpPass,
    },
  });

  await transporter.sendMail({
    from: `"Connecteo Contact" <${envConfig.email.smtpUser}>`,
    to: envConfig.email.contactRecipient,
    subject: `Nouveau message de ${data.first_name} ${data.last_name}`,
    html: buildHtmlMessage(data),
    replyTo: data.email,
  });
}
