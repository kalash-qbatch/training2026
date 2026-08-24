import "dotenv/config";

import { verifySmtpConnection } from "../lib/mail";

async function main() {
  console.log("Testing SMTP connection with settings:");
  console.log("SMTP_HOST:", process.env.SMTP_HOST);
  console.log("SMTP_PORT:", process.env.SMTP_PORT);
  console.log("SMTP_USER:", process.env.SMTP_USER);
  console.log("SMTP_PASS length:", process.env.SMTP_PASS?.length || 0);
  console.log("SMTP_PASSWORD length:", process.env.SMTP_PASSWORD?.length || 0);

  try {
    await verifySmtpConnection();
    console.log("SMTP Connection test successful!");
  } catch (error) {
    console.error("SMTP Connection test failed:", error);
  }
}

main();
