import jwt from "jsonwebtoken";
import { StringValue } from "ms";

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

export function issueAccessToken(user: Express.User) {
    return jwt.sign(
        {sub: user.id, email: user.email, aud: "app-api", iss: "app-auth"},
        JWT_SECRET,
        {expiresIn: (process.env.JWT_TTL || '15m') as StringValue}
    );
}