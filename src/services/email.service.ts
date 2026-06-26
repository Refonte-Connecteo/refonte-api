import { Resend } from "resend";
import { env } from "../config/env.config.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendInvitationEmail(email: string, token: string): Promise<void> {
  if (!resend) {
    console.log(`[EMAIL MOCK] Invitation email sent to ${email} with token: ${token}`);
    return;
  }

  const link = `${env.FRONTEND_URL}/admin/set-password?token=${token}`;

  const { error } = await resend.emails.send({
    from: "Connecteo <onboarding@resend.dev>",
    to: email,
    subject: "Invitation à rejoindre l'administration Connecteo",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1a73e8;">Bienvenue sur Connecteo</h1>
            <p>Vous avez été invité à rejoindre l'équipe d'administration de Connecteo.</p>
            <p>Pour activer votre compte, veuillez cliquer sur le lien ci-dessous :</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${link}"
                 style="background-color: #1a73e8; color: white; padding: 12px 24px;
                        text-decoration: none; border-radius: 4px; display: inline-block;">
                Activer mon compte
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              Ce lien expire dans ${env.INVITATION_TOKEN_EXPIRES_HOURS} heures.
            </p>
            <p style="color: #666; font-size: 14px;">
              Si vous n'avez pas demandé cette invitation, ignorez cet email.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
