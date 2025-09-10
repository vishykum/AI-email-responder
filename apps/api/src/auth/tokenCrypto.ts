//Encrypt and decrypt google auth tokens

import crypto from 'crypto';

const KEY_B64 = process.env.TOKEN_ENC_KEY_BASE64
if (!KEY_B64) throw new Error("TOKEN_ENC_KEY_BASE64 is not set");

const KEY = Buffer.from(KEY_B64, "base64");

const VERSION = "v1";

export function encryptToken(plaintext: string): string {
    const iv = crypto.randomBytes(12); // GCM nonce = 96-bit
    const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
        VERSION,
        iv.toString("base64"),
        ciphertext.toString("base64"),
        tag.toString("base64"),
    ].join(":");
}

export function decryptToken(packed: string): string {
    const [version, ivB64, ctB64, tagB64] = packed.split(":");
    if (version !== VERSION) throw new Error("Unsupported token encryption version");

    if (!ivB64 || !ctB64 || !tagB64) {
        throw new Error("Invalid encrypted token format");
    }

    const iv = Buffer.from(ivB64, "base64");
    const ct = Buffer.from(ctB64, "base64");
    const tag = Buffer.from(tagB64, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
    return plaintext.toString("utf8");
}