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
import { getGmailClient } from "../utils/gmailClient";

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

            // return res.json({
            //     ok: true,
            //     message: "Gmail account connected",
            //     connected_account_id: info?.connectedAccountId,
            //     email: info?.email,
            // });

            return res.redirect(`${process.env.CLIENT_URL!}/`);
        });

        mw(req, res, next);
    }
);

// POST /api/gmail/inbox
router.post('/inbox',
    authenticateWithRefresh(),
    async (req: Request, res: Response) => {
        cmdLogger.info("Inside POST /api/gmail/inbox", {user_id: req.user!.id});
    
        if ((!req.body.gmail_address || typeof req.body.gmail_address !== 'string') && (!req.body.n_threads || typeof req.body.n_threads !== 'number')) {
            cmdLogger.error("Request body formatted incorrectly");
            return res.status(400).json({message: "Request body formatted incorrectly"});
        }

        
        const gmail_address = req.body.gmail_address;
        const n_threads = req.body.n_threads;

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

            cmdLogger.info("Google account retrieved", {user_id: req.user!.id});

            cmdLogger.info(`req.userid: ${req.user ? req.user.id : "NO USER"}`);

            cmdLogger.info("Syncing gmail to DB...", {user_id: req.user!.id});

            try {
                const syncToDB = await syncGmailToDB(account);

                cmdLogger.info(`Sync results ${JSON.stringify(syncToDB)}`, {user_id: req.user!.id});

                try {
                    const fullThreads = await prisma.thread.findMany({
                    where: {connected_account_id: account.id},
                    orderBy: {last_message_at: 'desc'},
                    select : {
                        id: true,
                        subject: true,
                        message_count: true,
                        last_message_at: true,
                        messages: {
                            orderBy: {internal_date: 'asc'},
                            select: {
                                id: true,
                                snippet: true,
                                from_address: true,
                                to_addresses: true,
                                internal_date: true,
                                subject: true,
                                body_text: true,
                                body_html: true,
                                provider_message_id: true,
                                message_labels: {
                                    select: {
                                        label: {
                                            select: {
                                                name: true,
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    take: n_threads,
                    });

                    cmdLogger.info("Threads retreivied successfully", {user_id: req.user!.id});

                    res.json(fullThreads);
                } catch (err) {
                    cmdLogger.error(`Error while retreiving email threads (ERR: ${JSON.stringify(err)})`, {user_id: req.user!.id});
                    return res.status(500).json({ message: "Internal server error" });
                }
            } catch(err) {
                cmdLogger.error(`Error while syncing gmail account (ERR: ${JSON.stringify(err)})`, {user_id: req.user!.id});
                return res.status(500).json({ message: "Internal server error" });
            }
        } catch (err) {
            cmdLogger.error(`Error while retreiving gmail account (ERR: ${JSON.stringify(err)})`, {user_id: req.user!.id});
            return res.status(500).json({ message: "Internal server error" });
        }
});

//Helper functions for reply route
function parseFirstEmail(headerValue: string): string | null {
  // grab the first email from something like:
  //   Bob <bob@x>, "Support" <help@x>, alice@x
  const emails = headerValue.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return emails?.[0]?.trim() ?? null;
}

function toBase64Url(str: string) {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildTextReplyMime(opts: {
  from: string;
  to: string;
  subject: string;
  inReplyTo: string | undefined;
  references?: string;
  bodyText: string;
}) {
  const lines = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    ...(opts.inReplyTo ? [`In-Reply-To: ${opts.inReplyTo}`] : []),
    ...(opts.references ? [`References: ${opts.references}`] : []),
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    opts.bodyText,
  ];
  return lines.join("\r\n");
}

function buildHtmlReplyMime(opts: {
  from: string;
  to: string;
  subject: string;
  inReplyTo: string | undefined;
  references?: string;
  bodyHtml: string;
}) {
  const boundary = "b1_" + Math.random().toString(16).slice(2);
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    ...(opts.inReplyTo ? [`In-Reply-To: ${opts.inReplyTo}`] : []),
    ...(opts.references ? [`References: ${opts.references}`] : []),
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const textAlt = opts.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return [
    ...headers,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    textAlt,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    ``,
    opts.bodyHtml,
    `--${boundary}--`,
  ].join("\r\n");
}

//POST /api/gmail/reply
router.post("/reply", 
    authenticateWithRefresh(),
    async (req: Request, res: Response) => {
        const { gmail_address, provider_message_id, body_text, body_html } = req.body as {
        gmail_address: string;
        provider_message_id: string;
        body_text?: string;
        body_html?: string;
        };

        if (!gmail_address || !provider_message_id || (!body_text && !body_html)) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        //Verify if the connected account belongs to user
        try {
            const account = await prisma.connectedAccount.findUnique({
                where: {email_address: gmail_address},
            });

            if (!account || account.user_id !== req.user!.id || account.provider !== $Enums.Provider.GOOGLE) {
                return res.status(401).json({ message: "Gmail account not found or unauthorized" });
            }

            //Build Gmail Client
            const tokens: GmailClientToken = {
                user_id: account.user_id,
                email_id: account.email_address,
                access_token: decryptToken(account.access_token_encrypted),
                refresh_token: decryptToken(account.refresh_token_encrypted),
                ...(account.token_expiry ? { expiry_date: account.token_expiry.getTime() } : {}),
            };

            const gmail = getGmailClient(tokens);

            //Fetch original message metadata
            const orig = await gmail.users.messages.get({
                userId: "me",
                id: provider_message_id,
                format: "metadata",
                metadataHeaders: ["Subject", "From", "Reply-To", "Message-ID", "References"],
            });

            const threadId = orig.data.threadId!;
            const headers = (orig.data.payload?.headers ?? []) as {name?: string; value?: string}[];

            const H = (n: string) =>
                headers.find(h => h.name?.toLowerCase() === n.toLowerCase())?.value ?? null;
            
            const origSubject = H("Subject") ?? "";
            const inReplyTo = H("Message-ID") ?? undefined; // RFC822 Message-ID
            const prevRefs = H("References") ?? "";
            const toHeader = H("Reply-To") || H("From") || "";

            const to = parseFirstEmail(toHeader);

            if (!to) {
                return res.status(400).json({ message: "Could not determine recipient (Reply-To/From missing)" });
            }

            const subject = /^re:\s/i.test(origSubject) ? origSubject : `Re: ${origSubject}`;
            const references = [prevRefs, inReplyTo].filter(Boolean).join(" ").trim();

            //Build MIME (no display name—just the address)
            const fromDisplay = gmail_address;

            const mime = body_html
                ? buildHtmlReplyMime({ from: fromDisplay, to, subject, inReplyTo, references, bodyHtml: body_html })
                : buildTextReplyMime({ from: fromDisplay, to, subject, inReplyTo, references, bodyText: body_text! });

            const raw = toBase64Url(mime);

            //Send in same thread
            const sent = await gmail.users.messages.send({
                userId: "me",
                requestBody: {raw, threadId},
            });

            cmdLogger.info(`Reply sent successfully: ${JSON.stringify({
                ok: true,
                message: "Reply sent",
                provider_message_id: sent.data.id,
                threadId: sent.data.threadId,
            })}`);

            return res.json({ok: true});
        }   catch (err) {
            cmdLogger.error(`Error sending reply: ${String(err)}`, { user_id: req.user!.id });
            return res.status(500).json({ message: "Internal server error" });
        }
    }
);

//Helper functions to send emails
function extractEmails(input?: string | string[]): string[] {
  if (!input) return [];
  const text = Array.isArray(input) ? input.join(",") : input;
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  // Deduplicate + trim
  return Array.from(new Set(matches.map(s => s.trim())));
}


function buildTextMime(opts: {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText: string;
}) {
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to.join(", ")}`,
    ...(opts.cc && opts.cc.length ? [`Cc: ${opts.cc.join(", ")}`] : []),
    ...(opts.bcc && opts.bcc.length ? [`Bcc: ${opts.bcc.join(", ")}`] : []),
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
  ];

  return [...headers, "", opts.bodyText].join("\r\n");
}

function buildHtmlMime(opts: {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
}) {
  const boundary = "b1_" + Math.random().toString(16).slice(2);
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to.join(", ")}`,
    ...(opts.cc && opts.cc.length ? [`Cc: ${opts.cc.join(", ")}`] : []),
    ...(opts.bcc && opts.bcc.length ? [`Bcc: ${opts.bcc.join(", ")}`] : []),
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const textAlt = opts.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return [
    ...headers,
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    textAlt,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    "",
    opts.bodyHtml,
    `--${boundary}--`,
  ].join("\r\n");
}

router.post("/send",
    authenticateWithRefresh(),
    async (req: Request, res: Response) => {
        const {
            gmail_address,
            to,
            cc,
            bcc,
            subject,
            body_text,
            body_html,
        } = req.body as {
            gmail_address: string;
            to: string | string[];
            cc?: string | string[];
            bcc?: string | string[];
            subject: string;
            body_text?: string;
            body_html?: string;
        }

        //Request body validation
        if (!gmail_address || !to || !subject || (!body_text && !body_html)) {
            return res.status(400).json({error: "Missing required fields"});
        }

        const toList = extractEmails(to);
        const ccList = extractEmails(cc);
        const bccList = extractEmails(bcc);

        if (toList.length === 0) {
            return res.status(400).json({error: "No valid recipient email in 'to'"});
        }

        try {
            //Verify that account belongs to user and has GOOGLE as provider
            const account = await prisma.connectedAccount.findUnique({
                where: {email_address: gmail_address},
            });

            if (
                !account ||
                account.user_id !== req.user!.id ||
                account.provider !== $Enums.Provider.GOOGLE
            ) {
                return res.status(401).json({error: "Gmail account not found or unauthorized"});
            }

            //Build Gmail client
            const tokens: GmailClientToken = {
                user_id: account.user_id,
                email_id: account.email_address,
                access_token: decryptToken(account.access_token_encrypted),
                refresh_token: decryptToken(account.refresh_token_encrypted),
                ...(account.token_expiry ? {expiry_date: account.token_expiry.getTime()}: {}),
            };

            const gmail = getGmailClient(tokens);

            //From: Just the address (no display name)
            const fromDisplay = gmail_address;

            //Build MIME
            const mime = body_html
                        ? buildHtmlMime({
                            from: fromDisplay,
                            to: toList,
                            cc: ccList,
                            bcc: bccList,
                            subject,
                            bodyHtml: body_html,
                        })
                        : buildTextMime({
                            from: fromDisplay,
                            to: toList,
                            cc: ccList,
                            bcc: bccList,
                            subject,
                            bodyText: body_text!
                        });
            
            const raw = toBase64Url(mime);

            //Send as new message
            const sent = await gmail.users.messages.send({
                userId: "me",
                requestBody: {raw},
            });

            cmdLogger.info(
                `Email sent successfully: ${JSON.stringify({
                    provider_message_id: sent.data.id,
                    threadId: sent.data.threadId,
                    to: toList,
                    cc: ccList,
                    bcc: bccList.length ? "[redacted]" : undefined,
                })}`
            );

            return res.json({
                ok: true,
                provider_message_id: sent.data.id,
                thread_id: sent.data.threadId,
            });
        } catch (err) {
            cmdLogger.error(`Error sending email: ${String(err)}`, {
                user_id: req.user!.id,
            });

            return res.status(500).json({ message: "Internal server error" });
        }
    }
);

export default router;