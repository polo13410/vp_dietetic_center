import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  /**
   * Development: Mailpit on localhost:1025 (docker compose). Deployed: Brevo's SMTP relay on
   * port 587, where the connection must be upgraded to TLS before the credentials are sent.
   */
  constructor(private readonly config: ConfigService) {
    const user = this.config.get<string>('smtp.user');
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('smtp.host', 'localhost'),
      port: this.config.get<number>('smtp.port', 1025),
      secure: this.config.get<boolean>('smtp.secure', false),
      requireTLS: !!user,
      // Fail fast rather than keep a connection waiting
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth: user ? { user, pass: this.config.get<string>('smtp.pass') } : undefined,
    });
  }

  async sendPasswordReset(to: string, token: string, firstName: string): Promise<void> {
    const frontendUrl = this.config.get<string>('appUrl', 'http://localhost:5173');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    const from = this.config.get<string>('smtp.from', 'noreply@vp-dietetic.fr');

    await this.transporter.sendMail({
      from,
      to,
      subject: 'Réinitialisation de votre mot de passe — VP Diététique',
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="color: #2563eb;">Réinitialisation du mot de passe</h2>
          <p>Bonjour ${escapeHtml(firstName)},</p>
          <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :</p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}"
               style="background: #2563eb; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
              Réinitialiser mon mot de passe
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">
            Ce lien est valable <strong>1 heure</strong>. Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">VP Diététique Center</p>
        </div>
      `,
      text: `Bonjour ${firstName},\n\nCliquez sur ce lien pour réinitialiser votre mot de passe :\n${resetUrl}\n\nCe lien est valable 1 heure.`,
    });

    // The address is personal data: not logged
    this.logger.log('Password reset email sent');
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
