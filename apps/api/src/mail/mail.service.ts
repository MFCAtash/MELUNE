import { Injectable, Logger } from "@nestjs/common";

/**
 * Stub mail service. Logs the outgoing email instead of sending it.
 *
 * Swapping in a real provider (SES, Resend, Postmark, ...) later only
 * means changing this class's implementation — every caller already
 * depends on this interface, not on a specific provider.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.WEB_APP_URL ?? "http://localhost:3000"}/reset-password?token=${resetToken}`;
    this.logger.log(`[stub email] Password reset for ${to} -> ${resetUrl}`);
  }

  async sendVerificationEmail(to: string, verifyToken: string): Promise<void> {
    const verifyUrl = `${process.env.WEB_APP_URL ?? "http://localhost:3000"}/verify-email?token=${verifyToken}`;
    this.logger.log(`[stub email] Verify email for ${to} -> ${verifyUrl}`);
  }
}
