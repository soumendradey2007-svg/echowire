
import { config } from '../config';

export class EmailService {
  static async sendVerificationEmail(to: string, username: string, token: string) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('[EMAIL] RESEND_API_KEY not set in .env. Verification email skipped.');
      return false;
    }

    const baseUrl = config.clientOrigin ? config.clientOrigin.replace(/\/$/, '') : 'https://echowire.vercel.app';
    const verifyUrl = `${baseUrl}?verify_token=${token}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #09090b; color: #f4f4f5; padding: 40px 20px; text-align: center;">
        <div style="max-width: 480px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 32px; text-align: left;">
          <h1 style="color: #f4f4f5; font-size: 20px; font-weight: 600; margin-bottom: 8px;">Welcome to EchoWire</h1>
          <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
            Hey ${username}, thanks for signing up. Please verify your email address to activate your account and start voice chatting.
          </p>
          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${verifyUrl}" style="background-color: #7c7cf5; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; padding: 12px 24px; border-radius: 6px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #71717a; font-size: 12px; line-height: 1.4;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${verifyUrl}" style="color: #7c7cf5;">${verifyUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #27272a; margin: 24px 0;" />
          <p style="color: #52525b; font-size: 11px;">If you did not create this account, you can safely ignore this email.</p>
        </div>
      </div>
    `;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'EchoWire <onboarding@resend.dev>',
          to: [to],
          subject: 'Verify your EchoWire account',
          html,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('[RESEND ERROR]', data);
        return false;
      }
      console.log(`[EMAIL] Verification email sent to ${to}`);
      return true;
    } catch (err) {
      console.error('[EMAIL FAILED]', err);
      return false;
    }
  }

  static async sendPasswordResetEmail(to: string, username: string, token: string) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('[EMAIL] RESEND_API_KEY not set in .env. Password reset email skipped.');
      return false;
    }

    const baseUrl = config.clientOrigin ? config.clientOrigin.replace(/\/$/, '') : 'https://echowire.vercel.app';
    const resetUrl = `${baseUrl}?reset_token=${token}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #09090b; color: #f4f4f5; padding: 40px 20px; text-align: center;">
        <div style="max-width: 480px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 32px; text-align: left;">
          <h1 style="color: #f4f4f5; font-size: 20px; font-weight: 600; margin-bottom: 8px;">Reset your EchoWire password</h1>
          <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
            Hey ${username}, we received a request to reset your password. Click the button below to choose a new password. This link is valid for 1 hour.
          </p>
          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${resetUrl}" style="background-color: #7c7cf5; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; padding: 12px 24px; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #71717a; font-size: 12px; line-height: 1.4;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${resetUrl}" style="color: #7c7cf5;">${resetUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #27272a; margin: 24px 0;" />
          <p style="color: #52525b; font-size: 11px;">If you didn't request this password reset, you can safely ignore this email.</p>
        </div>
      </div>
    `;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'EchoWire <onboarding@resend.dev>',
          to: [to],
          subject: 'Reset your EchoWire password',
          html,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('[RESEND ERROR]', data);
        return false;
      }
      console.log(`[EMAIL] Password reset email sent to ${to}`);
      return true;
    } catch (err) {
      console.error('[EMAIL FAILED]', err);
      return false;
    }
  }
}
