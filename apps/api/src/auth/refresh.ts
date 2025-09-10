import crypto from "crypto";

export function createOpaqueToken(bytes = 64) {
    return crypto.randomBytes(bytes).toString("base64url");
}

export function hashRefreshToken(token: string) {
    return crypto.createHmac("sha256", process.env.RT_SECRET!).update(token).digest("hex");
}