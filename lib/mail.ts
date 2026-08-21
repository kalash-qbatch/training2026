import nodemailer from "nodemailer";

import { resetTokenExpiryLabel } from "@/lib/constants/auth";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured. Check SMTP_HOST, SMTP_USER, SMTP_PASS in .env");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  resetUrl: string;
  fullName?: string;
}) {
  const from = process.env.EMAIL_SENDER || process.env.SMTP_USER!;
  const transporter = getTransporter();
  const name = opts.fullName?.split(" ")[0] || "there";
  const expiryLabel = resetTokenExpiryLabel();

  await transporter.sendMail({
    from: `"User Module" <${from}>`,
    to: opts.to,
    subject: "Reset your password",
    text: [
      `Hi ${name},`,
      "",
      "We received a request to reset your password.",
      `Use this link within ${expiryLabel} (one-time use only):`,
      opts.resetUrl,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;background:#f4f5f7;padding:32px 16px;">
        <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
          <h1 style="margin:0 0 12px;font-size:22px;color:#2563eb;">Reset Password</h1>
          <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5;">
            Hi ${name}, we received a request to reset your password.
          </p>
          <p style="margin:0 0 8px;color:#6b7280;font-size:14px;line-height:1.5;">
            Click the button below to choose a new password.
          </p>
          <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.5;">
            This link expires in <strong style="color:#374151;">${expiryLabel}</strong>
            and can only be used <strong style="color:#374151;">once</strong>.
            After a successful reset (or when the time runs out), the link will no longer work.
          </p>
          <a href="${opts.resetUrl}"
             style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;">
            Reset Password
          </a>
          <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;line-height:1.5;">
            If you did not request a password reset, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
  });
}

export async function verifySmtpConnection() {
  const transporter = getTransporter();
  await transporter.verify();
}
