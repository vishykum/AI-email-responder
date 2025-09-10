import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { ExtractJwt } from "passport-jwt";
import passport from "passport";
import { IVerifyOptions } from "passport-local";
import prisma from '../libs/prisma';
import { issueAccessToken } from "../auth/tokens";
import { hashRefreshToken } from "../auth/refresh";
import ms, { StringValue } from "ms";
import { cmdLogger } from "../utils/logger";


const extractToken = ExtractJwt.fromExtractors([
                (req) => req?.cookies?.access_token || null, //Check cookies first
                ExtractJwt.fromAuthHeaderAsBearerToken()
]);

export async function checkNotAuthenticated(req: Request, res: Response, next: NextFunction) {
    const token = extractToken(req);
    cmdLogger.info('Inside checkNotAuthenticated middleware function');

    if (!token) {
        //If no jwt check for refreshToken
        const refreshToken = req.cookies.refresh_token;

        if (!refreshToken) return next();

        try {
            const DBToken = await prisma.refreshToken.findUnique({
                where: {tokenHash: hashRefreshToken(refreshToken)},
                include: {user: true}
            });

            //If Refresh token is not valid anymore
            const now = new Date();
            if (!DBToken || DBToken.revoked || DBToken.expires_at <= now || !DBToken.user) {
                cmdLogger.warn("Refresh token invalid");
                return next();
            }

            //Client has valid refresh token

            cmdLogger.info("Refresh token retreived and valid");

            //Issue jwt
            const jwt = issueAccessToken({id: DBToken.user.id, email: DBToken.user.display_email});

            cmdLogger.info("JWT issued", {user_id: DBToken.user.id});

            //Set cookie
            res.cookie("access_token", jwt, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: ms((process.env.JWT_TTL || '15m') as StringValue)
            });
            
            cmdLogger.info('Set access_token cookie with JWT', {user_id: DBToken.user.id});

            return res.json({message: "New access token created"});
        } catch (err) {
            cmdLogger.error(`Error retreiving refresh token hash: ${err}`);
            return res.status(500).json({error: "Error retreiving refresh token hash"});
        }
    }

    try {
        const decoded = jwt.verify(token!, process.env.JWT_SECRET || "default_secret");

        cmdLogger.info("JWT is valid", {user_id: decoded.sub});
        return res.status(403).json({error: "User already authenticated"});
    } catch(err) {
        cmdLogger.error("Error verifying JWT");
        next();
    }
}

export function authenticateWithRefresh() {
    return async (req: Request, res: Response, next: NextFunction) => {
        const mw = passport.authenticate("jwt", {session: false}, async (err: Error, user: Express.User|null, info: IVerifyOptions) => {
            cmdLogger.info("Inside authenticateWithRefresh middleware function");
            if (err) return next(err);

            //If JWT exists and user found by Id
            if (user) {
                cmdLogger.info("JWT exists");
                req.user = user;
                return next();
            }

            //Refresh logic
            try {
                const refreshToken = req.cookies?.refresh_token as string | undefined;

                if (!refreshToken) {
                    cmdLogger.warn("No refresh token");
                    return res.status(401).json({error: "Unauthorized"});
                }

                //Check if refreshToken is in DB
                const DBToken = await prisma.refreshToken.findUnique({
                    where: {tokenHash: hashRefreshToken(refreshToken)},
                    include: {user: true}
                });

                const now = new Date();

                //If refresh token is not valid
                if (!DBToken || DBToken.revoked || DBToken.expires_at <= now || !DBToken.user) {
                    cmdLogger.warn("Invalid refresh token");
                    return res.status(401).json({error: "Unauthorized"});
                }

                cmdLogger.info("Valid refresh token", {user_id: DBToken.user.id});
                //Else issue new jwt access token
                const access = issueAccessToken({
                    id: DBToken.user.id,
                    email: DBToken.user.display_email
                } as Express.User);

                //Set cookie and attach req.user
                res.cookie("access_token", access, {
                    httpOnly: true,
                    sameSite: "lax",
                    secure: process.env.NODE_ENV === "production",
                    maxAge: ms((process.env.JWT_TTL || '15m') as StringValue)
                });

                cmdLogger.info("JWT created and stored in access_token cookie", {user_id: DBToken.user.id});

                req.user = {id: DBToken.user.id, email: DBToken.user.display_email};

                cmdLogger.info("Populated req.user", {user_id: req.user.id});

                return next();
            } catch(err: any) {
                 cmdLogger.error(`Failed to retreive refresh token (ERR_CODE: ${err?.code ?? 'N/A'})`);

                return next(err as Error);
            }
        });

        mw(req, res, next);
    };
}

//Check if user has valid tokens to request gmail resources
export async function checkAuthGmailWithRefresh(req: Request, res: Response, next: NextFunction) {
    
}