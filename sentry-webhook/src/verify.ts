import crypto from "node:crypto";

/**
 * Verify the Sentry webhook signature using HMAC-SHA256.
 * The signature is sent in the `sentry-hook-signature` header.
 * The secret is the Client Secret from your Sentry Internal Integration.
 */
export function verifySentrySignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body, "utf8");
  const expected = hmac.digest("hex");

  // Use timingSafeEqual to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}
