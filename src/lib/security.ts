import crypto from "crypto";

const IV_LENGTH = 16;
const MIN_SECRET_LENGTH = 32;

function getTokenEncryptionSecret() {
  const raw = process.env.TOKEN_ENCRYPTION_SECRET;

  if (!raw || raw.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `TOKEN_ENCRYPTION_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters before social tokens can be encrypted or decrypted.`,
    );
  }

  return raw;
}

function getKey() {
  return crypto.createHash("sha256").update(getTokenEncryptionSecret()).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string) {
  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = buffer.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
