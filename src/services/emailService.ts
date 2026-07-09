import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? "no-reply@manarah.com";

// Create transporter if SMTP settings are present
const transporter = (SMTP_HOST && SMTP_USER && SMTP_PASS)
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // use SSL if port is 465
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null;

/**
 * Standard responsive HTML wrapper for MANARAH emails
 */
function wrapEmailTemplate(title: string, bodyHtml: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8fafc;
            color: #1e293b;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
          }
          .header {
            background: linear-gradient(135deg, #0e7a3e 0%, #15803d 100%);
            padding: 32px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 800;
            letter-spacing: 0.05em;
          }
          .content {
            padding: 40px 32px;
            line-height: 1.6;
          }
          .content p {
            margin: 0 0 16px 0;
            font-size: 15px;
          }
          .button-container {
            text-align: center;
            margin: 32px 0;
          }
          .button {
            display: inline-block;
            background-color: #0e7a3e;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 32px;
            font-weight: bold;
            font-size: 14px;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(14, 122, 62, 0.2);
            transition: background-color 0.2s;
          }
          .button:hover {
            background-color: #15803d;
          }
          .footer {
            background-color: #f1f5f9;
            padding: 24px 32px;
            text-align: center;
            font-size: 11px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
          }
          .footer a {
            color: #0e7a3e;
            text-decoration: none;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MANARAH</h1>
          </div>
          <div class="content">
            ${bodyHtml}
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} MANARAH. All rights reserved.</p>
            <p>Learn · Teach · Compete — Islamic learning and competition platform</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Send email using Nodemailer Transporter, fallback to console logging in dev if not configured.
 */
async function sendMail(to: string, subject: string, html: string) {
  if (!transporter) {
    console.log("==================================================");
    console.log(`[EMAIL DEV LOG] Sending email to: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`From: ${SMTP_FROM}`);
    console.log("-----------------------");
    console.log("HTML Body Preview:");
    console.log(html);
    console.log("==================================================");
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM.includes("<") ? SMTP_FROM : `MANARAH <${SMTP_FROM}>`,
      to,
      subject,
      html,
    });
    console.log(`[Nodemailer Success] Email sent: ${info.messageId}`);
  } catch (error: any) {
    console.error(`[Nodemailer Exception] Error sending email to ${to}:`, error);
  }
}

/**
 * Triggered on student or tutor registration signup
 */
export async function sendWelcomeEmail(to: string, name: string, role: string) {
  const roleDisplay = role.toLowerCase() === "student" ? "Student/Learner" : "Tutor/Educator";
  const bodyHtml = `
    <h2 style="margin-top: 0; color: #0e7a3e;">Welcome to MANARAH, ${name}!</h2>
    <p>We are thrilled to welcome you to our platform as a <strong>${roleDisplay}</strong>.</p>
    <p>MANARAH is designed to simplify Islamic learning, Quran recitation/memorization tracking, and recognized certificates competitions.</p>
    ${
      role.toLowerCase() === "student"
        ? `<p>You can now browse verified tutors, send lesson inquiries, enter open competitions, and start tracking your daily progress goals.</p>`
        : `<p>Please configure your biography, teaching experience, availability, and upload qualifications documents. Once an admin verifies your credentials, students will be able to search and message you.</p>`
    }
    <div class="button-container">
      <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/login" class="button" target="_blank">Access Your Dashboard</a>
    </div>
    <p>If you have any questions or need setup assistance, please reply to this email to contact our support team.</p>
  `;

  await sendMail(
    to,
    "Welcome to MANARAH!",
    wrapEmailTemplate(`Welcome to MANARAH, ${name}!`, bodyHtml)
  );
}

/**
 * Triggered when a user requests a forgot-password reset token
 */
export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const bodyHtml = `
    <h2 style="margin-top: 0; color: #0e7a3e;">Reset Your Password</h2>
    <p>We received a request to reset the password associated with your account on MANARAH.</p>
    <p>Please click the button below to set up a new password. This link is valid for 1 hour:</p>
    <div class="button-container">
      <a href="${resetLink}" class="button" target="_blank">Reset Password Now</a>
    </div>
    <p>If you did not request a password reset, you can safely ignore this email — your account remains secure.</p>
  `;

  await sendMail(
    to,
    "Reset Your MANARAH Password",
    wrapEmailTemplate("Reset Your Password", bodyHtml)
  );
}

/**
 * Real-time notification backup alerts
 */
export async function sendNotificationEmail(to: string, title: string, body: string) {
  const bodyHtml = `
    <h2 style="margin-top: 0; color: #0e7a3e;">${title}</h2>
    <p>You have received a new notification alert on MANARAH:</p>
    <div style="background-color: #f8fafc; border-left: 4px solid #0e7a3e; padding: 16px; border-radius: 8px; margin: 24px 0; font-style: italic; font-size: 14px; color: #334155;">
      ${body}
    </div>
    <p>Log in to your portal to review notifications history or respond directly:</p>
    <div class="button-container">
      <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}" class="button" target="_blank">Open Portal</a>
    </div>
  `;

  await sendMail(
    to,
    `MANARAH Alert: ${title}`,
    wrapEmailTemplate(title, bodyHtml)
  );
}
