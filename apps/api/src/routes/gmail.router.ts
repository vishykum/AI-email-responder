import { Router } from "express";
import type {NextFunction, Request, Response} from "express";
import { authenticateWithRefresh } from "../middlewares/auth.middleware";
import prisma from "../libs/prisma";
import { cmdLogger } from "../utils/logger";
import { decryptToken } from "../auth/tokenCrypto";
import { $Enums, ConnectedAccount } from "../../generated/prisma";
import { gmail_v1 } from "googleapis";
import { syncGmailToDB } from "../utils/syncGmailToDB";
import { google } from "googleapis";
import passport, { AuthenticateOptions } from "passport";
import { AuthenticateOptionsGoogle } from "passport-google-oauth20";

const router: Router = Router();

//TODO: Implement route to add gmail account for users with other primary email id

// ---------- Config ----------
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!; // e.g. https://api.example.com/auth/google/callback

// Add/trim scopes to your needs (modify requires gmail.modify if you use history/watch)
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

const googleAuthOpts: AuthenticateOptionsGoogle & {session: false} = {
    scope: SCOPES,
    accessType: "offline",
    prompt: "consent",
    includeGrantedScopes: true,
    session: false,
};

// GET /api/gmail/connect
router.get('/connect',
    authenticateWithRefresh(),
    (req: Request, res: Response, next: NextFunction) => {
        passport.authenticate("google-connect", googleAuthOpts)(req,res,next);
    }
);

// GET /api/gmail/connect/callback
router.get("/connect/callback",
    authenticateWithRefresh(),
    (req: Request, res: Response, next: NextFunction) => {
        const mw = passport.authenticate("google-connect", {session: false}, (err: Error | null | unknown, user: Express.User | false, info: any) => {
            if (err) {
                return res.status(500).json({ error: "OAuth error", details: String(err) });
            }

            if (!user) {
                return res.status(400).json({ error: info?.message ?? "Failed to connect Gmail" });
            }

            return res.json({
                ok: true,
                message: "Gmail account connected",
                connected_account_id: info?.connectedAccountId,
                email: info?.email,
            });
        });

        mw(req, res, next);
    }
);

// GET /api/gmail/inbox?gmail_id=[gmail_address]
router.get('/inbox',
    authenticateWithRefresh(),
    async (req: Request, res: Response) => {
        cmdLogger.info("Inside GET /api/gmail/inbox", {user_info: req.user!.id});
    
        const gmail_address = req.query.gmail_id;

        if (!gmail_address || typeof gmail_address !== 'string') {
            cmdLogger.error("Query parameters does not contain valid gmail_id");
            return res.status(400).json({message: "Missing or invalid gmail_id in request query parameters"});
        }

        try {
            const account = await prisma.connectedAccount.findUnique({
                where: {
                    email_address: gmail_address,
                }
            });

            if (!account || account.user_id !== req.user!.id || account.provider !== $Enums.Provider.GOOGLE) {
                cmdLogger.warn("Gmail account not found or unauthorized", { user_info: req.user!.id });
                return res.status(401).json({ message: "Gmail account not found or unauthorized" });
            }

            cmdLogger.info("Google account retrieved", {user_info: req.user!.id});

            cmdLogger.info("Syncing gmail to DB...", {user_info: req.user!.id});

            try {
                const syncToDB = await syncGmailToDB(account);

                cmdLogger.info(`Sync results ${JSON.stringify(syncToDB)}`, {user_info: req.user!.id});

                try {
                    const fullThreads = await prisma.thread.findMany({
                    where: {connected_account_id: account.id},
                    orderBy: {last_message_at: 'desc'},
                    select : {
                        id: true,
                        subject: true,
                        message_count: true,
                        messages: {
                            where: {body_text: {not: null}}, //Delete this
                            orderBy: {internal_date: 'desc'},
                            select: {
                                id: true,
                                internal_date: true,
                                subject: true,
                                body_text: true
                            }
                        }
                    },
                    take: 5,
                    });

                    res.json(fullThreads.map(x => x.messages));
                } catch (err) {
                    cmdLogger.error(`Error while retreiving email threads (ERR: ${JSON.stringify(err)})`, {user_info: req.user!.id});
                    return res.status(500).json({ message: "Internal server error" });
                }
            } catch(err) {
                cmdLogger.error(`Error while syncing gmail account (ERR: ${JSON.stringify(err)})`, {user_info: req.user!.id});
                return res.status(500).json({ message: "Internal server error" });
            }
        } catch (err) {
            cmdLogger.error(`Error while retreiving gmail account (ERR: ${JSON.stringify(err)})`, {user_info: req.user!.id});
            return res.status(500).json({ message: "Internal server error" });
        }
});

export default router;