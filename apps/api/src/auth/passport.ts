import passport, { DoneCallback, Profile } from "passport";
import { Strategy as LocalStrategy, Strategy} from "passport-local";
import {Strategy as JwtStrategy, ExtractJwt} from "passport-jwt";
import {Strategy as GoogleStrategy, VerifyCallback} from "passport-google-oauth20";
import bcrypt from "bcrypt";
import { $Enums, PrismaClient } from "../../generated/prisma";
import { cmdLogger } from "../utils/logger";
import { Request } from "express";
import { getGmailMailboxEmail } from "../utils/gmail";
import { encryptToken } from "./tokenCrypto";

const prisma = new PrismaClient();

async function findUserByEmail(email: string): Promise<DBUser | null> {
    return prisma.user.findUnique({
        where: {display_email: email}
    });
}

async function findUserById(id: string): Promise<DBUser | null> {
        return prisma.user.findUnique({
        where: {id: id}
    });
}

passport.use(
    new LocalStrategy(
        {usernameField: "display_email", passwordField: "password", session: false},
        async (email, password, done) => {
            cmdLogger.info("Inside LocalStrategy verification callback function");
            try {
                const user = await findUserByEmail(email);

                if (!user) {
                    cmdLogger.warn("User not found");
                    return done(null, false, {message: "User not found"});
                }

                //Handle OAuth accounts
                if (!user.password_hash) {
                    return done(null, false, { message: "Password login not available for this account" });
                }

                cmdLogger.info("Valid user");

                try {
                    const isValid = await bcrypt.compare(password, user.password_hash);
                    if (!isValid) {
                        cmdLogger.warn("Incorrect password");
                        return done(null, false, {message: "Incorrect password"});
                    }
                } catch(err: any) {
                    cmdLogger.error(`Error while comparing hashed passwords (ERR_CODE: ${err?.code ?? 'N/A'})`);

                    return done(err as Error);
                }

                cmdLogger.info("Authentication successful", {user_id: user.id});
                return done(null, {id: user.id, email: user.display_email} as Express.User);
            } catch(err: any) {

                cmdLogger.error(`Error while retreiving user by email (ERR_CODE: ${err?.code ?? 'N/A'})`);

                return done(err as Error);
            }
        }
    )
);

passport.use(
    new JwtStrategy(
        {
            jwtFromRequest: ExtractJwt.fromExtractors(([
                (req) => req?.cookies?.access_token || null, //Check cookies first
                ExtractJwt.fromAuthHeaderAsBearerToken()
            ])),
            secretOrKey: process.env.JWT_SECRET || "default_secret"
        },
        async (payload: {sub: string, email : string}, done) => {
            try {
                cmdLogger.info("Inside JWTStrategy verification callback function");
                const user = await findUserById(payload.sub);
                if(!user) {
                    cmdLogger.warn("Invalid user_id in JWT");
                    return done(null, false);
                }

                cmdLogger.info("Authentication successful", {user_id: user.id});
                return done(null, {id: user.id, email: user.display_email} as Express.User);
            } catch (err: any) {
                cmdLogger.error(`Error while retreiving user by user_id (ERR_CODE: ${err?.code ?? 'N/A'})`);
                return done(err as Error);
            }
        }
    )
);

//TODO: Error handling required
passport.use(new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: `${process.env.SERVER_URL}api/login/google/callback`,
    },
    async (access_token: string, refresh_token: string, params: any, profile: Profile, done: VerifyCallback) => {
        cmdLogger.info("Inside GoogleStrategy verification callback function");

        try {
            const email = profile.emails?.[0]?.value;

            //Check if all necessary information exists
            if (!profile.id) {
                return done(null, false, {message: "Missing Google profile id"});
            }

            if (!email) {
                return done(null, false, {message: "Missing Gmail id"});
            }

            if (!params.expires_in) {
                cmdLogger.warn("Missing token expiry");
            }

            const token_expiry = params.expires_in ? new Date(Date.now() + params.expires_in * 1000) : null;      

            const first_name = profile.name?.givenName || profile.displayName?.split(" ")[0];
            const last_name = profile.name?.familyName || profile.displayName?.split(" ").slice(1).join(" ");

            if (!first_name || !last_name) {
                cmdLogger.warn("Missing first name or last name");
            }

            const user = {
                email: email,
                id: "", //No user id yet
                first_name: first_name,
                last_name: last_name,
            } as Express.User;

            const info: GoogleAuthInfo = {
                provider: "google",
                provider_user_id: profile.id,
                access_token: access_token,
                refresh_token: refresh_token,
                ...(token_expiry ? {token_expiry} : {})
            };

            return done(null, user, info);
        } catch(err) {
            return done(err, false);
        }
    }
));

//TODO: Error handling
passport.use("google-connect", new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: `${process.env.SERVER_URL}api/gmail/connect/callback`,
        passReqToCallback: true
    },
    async (req: Request, access_token: string, refresh_token: string, params: any, profile: Profile, done: VerifyCallback) => {
            cmdLogger.info("Inside google-connect verification callback function");
        
            if (!req.user?.id) return done(null, false, { message: "Not logged in" });

            //Build OAuth Client
            const userId = req.user.id;
            const googleId = profile.id;

            if (!googleId) return  done(null, false, { message: "Missing Google profile id" });

            //Authoritative mailbox address (requires a gmail.* scope)
            const mailboxEmail = await getGmailMailboxEmail(access_token);

            if (!mailboxEmail) {
                return done(null, false, {
                    message: "Gmail not available or gmail scope missing (need gmail.readonly at minimum)",
                });
            }

            const token_expiry =
                params?.expires_in ? new Date(Date.now() + Number(params.expires_in) * 1000) : null;

            //Scope string returned by Google
            const grantedScopes: string[] = String(params?.scope || "")
                .split(" ")
                .filter(Boolean);

            //Prevent linking same google account to different user
            const existing = await prisma.connectedAccount.findUnique({
                where: {
                    provider_provider_user_id: {
                        provider: $Enums.Provider.GOOGLE,
                        provider_user_id: googleId,
                    },
                },
                select: {id: true, user_id: true},
            });

            if (existing && existing.user_id !== userId) {
                return done(null, false, {
                    message: "This Google account is already connected by another user",
                });
            }

            //Upsert ConnectedAccount for this user
            const connected = await prisma.connectedAccount.upsert({
                where: {
                    provider_provider_user_id: {
                        provider: $Enums.Provider.GOOGLE,
                        provider_user_id: googleId,
                    },
                },
                create: {
                    user_id: userId,
                    provider: $Enums.Provider.GOOGLE,
                    provider_user_id: googleId,
                    email_address: mailboxEmail,
                    access_token_encrypted: encryptToken(access_token),
                    refresh_token_encrypted: encryptToken(refresh_token),
                    status: $Enums.TokenStatus.ACTIVE,
                    ...(token_expiry ? {token_expiry} : {})
                },
                update: {
                    email_address: mailboxEmail,
                    access_token_encrypted: encryptToken(access_token),
                    refresh_token_encrypted: encryptToken(refresh_token),
                    status: $Enums.TokenStatus.ACTIVE,
                    ...(token_expiry ? {token_expiry} : {})
                },
                select: {id: true, email_address: true},
            });

            cmdLogger.info("Gmail account created for user", {user_info: userId});

            const first_name = profile.name?.givenName || profile.displayName?.split(" ")[0];
            const last_name = profile.name?.familyName || profile.displayName?.split(" ").slice(1).join(" ");

            if (!first_name || !last_name) {
                cmdLogger.warn("Missing first name or last name");
            }

            const user = {
                email: req.user!.email,
                id: req.user!.id, //No user id yet
                first_name: first_name,
                last_name: last_name,
            } as Express.User;

            // Return the current app user and connection info (no login/session changes)
            return done(null, user, {
            connectedAccountId: connected.id,
            email: connected.email_address,
            });
        }
));

export default passport;