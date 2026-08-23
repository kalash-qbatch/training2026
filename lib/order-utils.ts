import crypto from "crypto";

/**
 * Generates a clean, unique, human-readable Order Number without relying on ad-hoc slice calls.
 * Example format: "ORD-928471"
 */
export function generateOrderNumber(): string {
  // Generate a random 6-digit number between 100000 and 999999
  const randomNum = crypto.randomInt(100000, 1000000);
  return `ORD-${randomNum}`;
}
