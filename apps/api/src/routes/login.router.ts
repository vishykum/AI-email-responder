import {Router} from 'express';
import type {NextFunction, Request, Response} from 'express';
import passport from 'passport';
import { issueAccessToken } from '../auth/tokens';
import { authenticateWithRefresh, checkNotAuthenticated } from '../middlewares/auth.middleware';
import { createOpaqueToken, hashRefreshToken } from '../auth/refresh';
import prisma from '../libs/prisma';
import ms from 'ms';
import type { StringValue } from 'ms';
import { cmdLogger } from '../utils/logger';
import { encryptToken } from '../auth/tokenCrypto';
import { $Enums } from '../../generated/prisma';

const router: Router = Router();

//POST /api/login/auth_local
router.post('/auth_local',
    checkNotAuthenticated,
    passport.authenticate("local", {session: false}),
    async (req: Request, res: Response) => {
        cmdLogger.info("Inside POST /api/login/authenticate handler", {user_id: req.user!.id});
        //JWT short-lived token
        const token = issueAccessToken(req.user!);

        //Refresh long-lived token
        const tokenString = createOpaqueToken();

        //Create RefreshToken object
        const refreshToken = {
            tokenHash: hashRefreshToken(tokenString),
            user_id: req.user!.id,
            expires_at: new Date(Date.now() + ms((process.env.RT_TTL || '7d') as StringValue)),
        };

        //Store refresh token in DB
        try {
            const storeToken = await prisma.refreshToken.create({
                data: refreshToken
            });
            cmdLogger.info("Refresh token successfully stored in db", {user_id: req.user!.id});
        } catch(err: any) {
            if (err?.code === "P2002") {
                cmdLogger.error("Refresh token conflict", {user_id: req.user!.id});
                return res.status(409).json({error: "Refresh token conflict, please retry"});
            }

            if (err?.code === "P2003") {
                cmdLogger.error("Invalid user reference", {user_id: req.user!.id});
                return res.status(400).json({error: "Invalid user reference"});
            }

            cmdLogger.error(`Failed to create refresh token (ERR: ${JSON.stringify(err)})`, {user_id: req.user!.id});
            return res.status(500).json({error: "Failed to create refresh token"});
        }

        //Create jwt access_token cookie
        res.cookie("access_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: ms((process.env.JWT_TTL || '15m') as StringValue)
        });

        //Create refresh_token cookie
        res.cookie('refresh_token', tokenString, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: ms((process.env.RT_TTL || '7d') as StringValue)
        }).status(200).json({message: "JWT and refresh token created"});

        cmdLogger.info("Access token and refresh token generated", {user_id: req.user!.id});
    }
);

router.get("/auth_google", 
    checkNotAuthenticated,
    passport.authenticate("google", {
    scope: ["openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send"
    ],
    accessType: "offline",
    prompt: "consent",
}));

router.get("/google/callback", (req: Request, res: Response, next: NextFunction) => {
    const mw = passport.authenticate("google", async (err: Error | null | unknown, user: Express.User | false, info: GoogleAuthInfo) => {
        if (err) {
            cmdLogger.error(`Error authenticating using Google ${err}`);
            return res.status(500).json({error: "Server Error", details: err});
        }

        if (!user) {
            return res.status(401).json({error: "Authentication failed", info: info});
        }

        req.user = user;

        //Check if user already exists in db
        try {
            const DBUser = await prisma.user.findUnique({
                where: {display_email: user.email}
            });

            //If no user exists create user
            if (!DBUser) {
                try {
                    const insertedUser = await prisma.user.create({
                        data: {
                            first_name: user.first_name || "NULL",
                            last_name: user.last_name || "NULL",
                            display_email: user.email,
                        }
                    });

                    cmdLogger.info("New user created");

                    req.user.id = insertedUser.id;

                    //Add gmail account to ConnectedAccount for user
                    try {
                        if (!info.access_token || !info.refresh_token || !info.provider_user_id || !info.token_expiry) {
                            throw Error("Info is not of type GoogleAuthInfo");
                        }
                        const insertedConnectedAccount = await prisma.connectedAccount.create({
                            data: {
                                provider: $Enums.Provider.GOOGLE,
                                provider_user_id: info.provider_user_id,
                                email_address: req.user.email,
                                user_id: insertedUser.id,
                                access_token_encrypted: encryptToken(info.access_token),
                                refresh_token_encrypted: encryptToken(info.refresh_token),
                                token_expiry: info.token_expiry,
                            }
                        });

                        cmdLogger.info("Gmail account linked with user");
                    } catch (err) {
                        cmdLogger.error(`Error creating account (ERR: ${JSON.stringify(err)})`);
                        return res.status(500).json({ message: "Internal server error" });
                    }
                } catch (err) {
                    cmdLogger.error(`Error creating user (ERR: ${JSON.stringify(err)})`);
                    return res.status(500).json({ message: "Internal server error"});
                }
            }

            else {
                req.user.id = DBUser.id;
            }
        } catch(err) {
                cmdLogger.error(`Error while retreiving user (ERR: ${JSON.stringify(err)})`);
                return res.status(500).json({ message: "Internal server error" });
        }

        // ── (2) ALWAYS upsert the Google connected account
        try {
            if (!info?.access_token || !info?.provider_user_id || !info?.token_expiry) {
                return res.status(400).json({ error: "Google callback missing tokens/profile" });
            }

            const existing = await prisma.connectedAccount.findFirst({
                where: { user_id: req.user!.id, provider: $Enums.Provider.GOOGLE },
                select: { id: true },
            });

            if (existing) {
                await prisma.connectedAccount.update({ where: { id: existing.id }, 
                    data: {
                            access_token_encrypted: encryptToken(info.access_token),
                            token_expiry: info.token_expiry,
                            ...(info.refresh_token
                                ? { refresh_token_encrypted: encryptToken(info.refresh_token) }
                                : {}),
                    }
                });
                cmdLogger.info("Updated Google connected account", { user_id: req.user!.id });
            } else {
            if (!info.refresh_token) {
                // first link must have a refresh token
                return res.status(400).json({ error: "No refresh_token from Google. Please reconnect with consent." });
            }

            await prisma.connectedAccount.create({
                data : {
                        provider: $Enums.Provider.GOOGLE,
                        provider_user_id: info.provider_user_id,
                        email_address: req.user!.email,
                        user_id: req.user!.id, // using UncheckedCreateInput; keep your style
                        access_token_encrypted: encryptToken(info.access_token),
                        refresh_token_encrypted: encryptToken(info.refresh_token), // required on create
                        token_expiry: info.token_expiry,
                }
            });
            cmdLogger.info("Created Google connected account", { user_id: req.user!.id });
            }
        } catch (e) {
            cmdLogger.error(`Error upserting Google connected account (ERR: ${JSON.stringify(e)})`);
            return res.status(500).json({ message: "Internal server error" });
        }

        //JWT short-lived token
        const token = issueAccessToken(req.user!);

        //Refresh long-lived token
        const tokenString = createOpaqueToken();

        //Create RefreshToken object
        const refreshToken = {
            tokenHash: hashRefreshToken(tokenString),
            user_id: req.user!.id,
            expires_at: new Date(Date.now() + ms((process.env.RT_TTL || '7d') as StringValue)),
        };

        //Store refresh token in DB
        try {
            const storeToken = await prisma.refreshToken.create({
                data: refreshToken
            });
            cmdLogger.info("Refresh token successfully stored in db", {user_id: req.user!.id});
        } catch(err: any) {
            if (err?.code === "P2002") {
                cmdLogger.error("Refresh token conflict", {user_id: req.user!.id});
                return res.status(409).json({error: "Refresh token conflict, please retry"});
            }

            if (err?.code === "P2003") {
                cmdLogger.error("Invalid user reference", {user_id: req.user!.id});
                return res.status(400).json({error: "Invalid user reference"});
            }

            cmdLogger.error(`Failed to create refresh token (ERR: ${JSON.stringify(err)})`, {user_id: req.user!.id});
            return res.status(500).json({error: "Failed to create refresh token"});
        }
        
        //Create acccess_token cookie
        res.cookie("access_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: ms((process.env.JWT_TTL || '15m') as StringValue)
        });

        //Create refresh_token cookie
        res.cookie('refresh_token', tokenString, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: ms((process.env.RT_TTL || '7d') as StringValue)
        });

        cmdLogger.info("Access token and refresh token generated", {user_id: req.user!.id});


        return res.redirect(`${process.env.CLIENT_URL!}/`);
    }); 
    
    mw(req,res,next);
});

//GET /api/login/me
router.get('/me',
    authenticateWithRefresh(),
    async (req: Request, res: Response) => {
        cmdLogger.info('Inside GET /api/login/me', {user_id: req.user!.id});

        try {
            const resp = await prisma.user.findUnique({
                where: {id: req.user!.id},
                select: {first_name: true, last_name: true, connected_accounts: {
                    select: {
                        provider: true,
                        email_address: true,
                    },
                }}
            });

            if (!resp) {
                return res.json({error: "Invalid user id"});
            }

            res.json({...req.user!, name: resp.first_name + " " + resp.last_name, accounts: resp.connected_accounts});
        } catch(err: any) {
            if (err?.code === "P2003") {
                cmdLogger.error("Invalid user reference", {user_id: req.user!.id});
                return res.status(400).json({error: "Invalid user reference"});
            }

            cmdLogger.error(`Failed to retreive user data (ERR: ${JSON.stringify(err)})`, {user_id: req.user!.id});
            return res.status(500).json({error: "Failed to retreive user data"});
        }
    }
);

// GET /api/login/logout
router.get('/logout',
    authenticateWithRefresh(),
    (req: Request, res: Response) => {
        cmdLogger.info('Inside /api/login/logout', {user_id: req.user!.id});
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
        
        cmdLogger.info('Cleared access_token and refresh_token cookies', {user_id: req.user!.id});

        res.status(200).json({ok: true, message: "Logout successful"});
    }
);

export default router;