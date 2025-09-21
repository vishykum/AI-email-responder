
import prisma from "../libs/prisma";
import { cmdLogger } from "../utils/logger";
import { getGmailClient } from "../utils/gmailClient";
import { decryptToken } from "../auth/tokenCrypto";
import {  ConnectedAccount } from "../../generated/prisma";
import type {Prisma} from "../../generated/prisma";
import { gmail_v1 } from "googleapis";
import { isInvalidGrant } from "./oauth";

//TODO: Handle attachments and error handling

//Get header's value in lowercase
function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string) {
  return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
}

// Split "A <a@x>, b@x" into ["A <a@x>", "b@x"]
function parseAddressList(raw: string | null) {
  return raw ? raw.split(",").map(s => s.trim()).filter(Boolean) : [];
}

// Compute read state from Gmail labelIds (UNREAD present => false)
function computeIsRead(labelIds?: string[]) {
  return !(labelIds ?? []).includes("UNREAD");
}

// Fetch a message in "full" format
async function fetchFullMessage(gmail: gmail_v1.Gmail, id: string) {
  const { data } = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  return data;
}

// Quick check for attachments (just metadata presence)
function hasAttachments(payload?: gmail_v1.Schema$MessagePart) {
  if (!payload) return false;
  let found = false;
  const walk = (p: gmail_v1.Schema$MessagePart) => {
    if (p.filename) found = true;
    if (p.parts?.length) p.parts.forEach(walk);
  };
  walk(payload);
  return found;
}

//Helper function to extract full message from gmail response
export function extractMessageBody(payload: gmail_v1.Schema$MessagePart | undefined): string | null {
    if (!payload) return null;

    // Case 1: simple message
    if (payload.body?.data) {
        return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    }

    // Case 2: multipart message
    if (payload.parts && payload.parts.length > 0) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/html' || part.mimeType === 'text/plain') {
                if (part.body?.data) {
                    return Buffer.from(part.body.data, 'base64url').toString('utf-8');
                }
            }

            // Recursively check nested parts
            const nested = extractMessageBody(part);
            if (nested) return nested;
        }
    }

    return null;
}

// Upsert one label by Gmail's id; return internal Label.id
async function upsertLabel(
  account: ConnectedAccount,
  gmailLabelId: string,
  name?: string,
  type?: string // "system" | "user"
) {
  const rec = await prisma.label.upsert({
    where: {
      connected_account_id_provider_label_id: {
        connected_account_id: account.id,
        provider_label_id: gmailLabelId,
      },
    },
    create: {
      connected_account_id: account.id,
      provider_label_id: gmailLabelId,
      name: name ?? gmailLabelId,
      type: (type === "system" ? "SYSTEM" : "USER") as any,
    },
    update: {
      name: name ?? gmailLabelId,
      type: (type === "system" ? "SYSTEM" : "USER") as any,
    },
    select: { id: true },
  });
  return rec.id;
}

// Build a cache of Gmail labels for this account once per sync to avoid N calls
async function getLabelsPerAccount(gmail: gmail_v1.Gmail) {
    const { data } = await gmail.users.labels.list({ userId: "me" });
    const all = data.labels ?? [];
    const byId = new Map<string, gmail_v1.Schema$Label>();
    for (const l of all) if (l.id) byId.set(l.id, l);
    return byId;
}

async function mapGmailLabelsToInternalIds(
  account: ConnectedAccount,
  labelMetaCache: Map<string, gmail_v1.Schema$Label>,
  gmailLabelIds?: string[]
) {
  if (!gmailLabelIds?.length) return [];
  const internalIds: string[] = [];
  for (const lid of gmailLabelIds) {
    const meta = labelMetaCache.get(lid);
    const internalId = await upsertLabel(account, lid, meta?.name ?? undefined, meta?.type ?? undefined);
    internalIds.push(internalId);
  }
  return internalIds;
}

async function reconcileMessgeLabels(
    messageId: string,
    nextInternalLabelIds: string[]
) {
    const current = await prisma.messageLabel.findMany({
        where: {message_id: messageId},
        select: {label_id: true}
    });

    const cur = new Set(current.map(x => x.label_id));
    const nxt = new Set(nextInternalLabelIds);

    const toAdd = nextInternalLabelIds.filter(id => !cur.has(id));
    const toDel = [...cur].filter(id => !nxt.has(id));

    const tx: any[] = [];

    for (const add of toAdd) {
        tx.push(prisma.messageLabel.create({
            data: {
                message_id: messageId,
                label_id: add
            }
        }));
    }

    for (const del of toDel) {
        tx.push(prisma.messageLabel.delete({
            where: {message_id_label_id: {message_id: messageId, label_id: del}}
        }));
    }

    if (tx.length) await prisma.$transaction(tx);
}

async function upsertThreadAndMessage(
    account: ConnectedAccount,
    fullMsg: gmail_v1.Schema$Message,
    labelMetaCache: Map<string, gmail_v1.Schema$Label>
) {
    const headers = fullMsg.payload?.headers ?? [];
    const from = getHeader(headers, "From") ?? "";
    const to = getHeader(headers, "To") ?? "";
    const cc = getHeader(headers, "Cc") ?? "";
    const bcc = getHeader(headers, "Bcc")  ?? "";
    const subject = getHeader(headers, "Subject") ?? "";
    const internalDateMs = fullMsg.internalDate ? Number(fullMsg.internalDate) : Date.now();

    const body = extractMessageBody(fullMsg.payload);
    const body_html = body && body.includes("<") ? body : null;
    const body_text = body_html ? null : (body ?? null);

    //Upsert thread first
    const thread = await prisma.thread.upsert({
        where: {
            connected_account_id_provider_thread_id: {
                connected_account_id: account.id,
                provider_thread_id: fullMsg.threadId!,
            },
        },
        create: {
            connected_account_id: account.id,
            provider_thread_id: fullMsg.threadId!,
            subject,
            last_message_at: new Date(internalDateMs),
            message_count: 0, // we will increment only if we actually create a message
            is_archived: false,
        },
        update: {
            subject,
            last_message_at: new Date(internalDateMs),
        },
        select: {id: true},
    });

    //Check if message exists
    const existing = await prisma.message.findUnique({
        where: {
            connected_account_id_provider_message_id: {
                connected_account_id: account.id,
                provider_message_id: fullMsg.id!
            },
        },
        select: {id: true}
    });

    let messageId: string;

    const toList  = parseAddressList(to);
    const ccList  = cc  ? parseAddressList(cc)  : null;
    const bccList = bcc ? parseAddressList(bcc) : null;

    if (!existing) {
        const created = await prisma.message.create({
            data : {
                thread_id: thread.id,
                connected_account_id: account.id,
                provider_message_id: fullMsg.id!,
                from_address: from,
                to_addresses: toList as unknown as Prisma.InputJsonValue,

                ...(ccList  !== null ? { cc_addresses:  ccList  as unknown as Prisma.InputJsonValue } : {}),
                ...(bccList !== null ? { bcc_addresses: bccList as unknown as Prisma.InputJsonValue}: {}),

                subject,
                snippet: fullMsg.snippet ?? "",
                internal_date: new Date(internalDateMs),

                headers_json: (fullMsg.payload?.headers ?? []) as unknown as Prisma.InputJsonValue,

                ...(body_text !== null ? { body_text } : {}),
                ...(body_html !== null ? { body_html } : {}),

                has_attachments: hasAttachments(fullMsg.payload),
                is_read: computeIsRead(fullMsg.labelIds ?? undefined),
            },
            select: {id: true},
        });

        messageId = created.id;

        //Increment message_count for thread
        await prisma.thread.update({
            where: {id: thread.id},
            data: {message_count: {increment: 1}},
        });
    }
    
    else {
        const updated = await prisma.message.update({
            where: {
                connected_account_id_provider_message_id: {
                connected_account_id: account.id,
                provider_message_id: fullMsg.id!,
                },
            },
            data: {
                snippet: fullMsg.snippet ?? "",

                headers_json: (fullMsg.payload?.headers ?? []) as unknown as Prisma.InputJsonValue,

                subject,
                body_text,
                body_html,
                internal_date: new Date(internalDateMs),
                has_attachments: hasAttachments(fullMsg.payload),
                is_read: computeIsRead(fullMsg.labelIds ?? undefined),
            },
            select: { id: true },
        });

        messageId = updated.id;
    }

    const nextInternalLabelIds = await mapGmailLabelsToInternalIds(
        account,
        labelMetaCache,
        fullMsg.labelIds ?? []
    );

    if (nextInternalLabelIds.length) {
        await reconcileMessgeLabels(messageId, nextInternalLabelIds);
    }

    return {threadId: thread.id, messageId};
}

async function hardDeleteMessageByProviderId(account: ConnectedAccount, providerMessageId: string) {
    const existing = await prisma.message.findUnique({
        where: {
            connected_account_id_provider_message_id: {
                connected_account_id: account.id,
                provider_message_id: providerMessageId,
            },
        },
        select: {id: true, thread_id: true},
    });

    if (!existing) return;

    await prisma.$transaction([
        prisma.messageLabel.deleteMany({where: {message_id: existing.id}}),
        prisma.attachment.deleteMany({where: {message_id: existing.id}}),
        prisma.message.delete({
            where: {
                connected_account_id_provider_message_id: {
                    connected_account_id: account.id,
                    provider_message_id: providerMessageId,
                },
            },
        }),
        prisma.thread.update({
            where: {id: existing.thread_id},
            data: {message_count: {decrement: 1}},
        }),
    ]);
}

export async function syncGmailToDB(account: ConnectedAccount) {
    //Get Gmail client
    const expiry_date = account!.token_expiry?.getTime();
    const tokens: GmailClientToken = {
        user_id: account.user_id,
        email_id: account.email_address,
        access_token: decryptToken(account!.access_token_encrypted),
        refresh_token: decryptToken(account!.refresh_token_encrypted),
        ...(expiry_date !== undefined ? {expiry_date} : {})
    };
    const gmail = getGmailClient(tokens);

    cmdLogger.info("Gmail client retreived successfully");

    // Probe once to trigger refresh now and classify errors early
    try {
        await gmail.users.getProfile({ userId: "me" });
    } catch (err) {
        if (isInvalidGrant(err)) {
        await prisma.connectedAccount.update({
            where: { id: account.id },
            data: { is_connected: false }, // add this column if you don't have it
        });
        // Return a typed signal the route can convert to 401
        return { ok: false, code: "OAUTH_RECONNECT_REQUIRED" as const };
        }
        throw err; // other errors follow your existing handlers
    }

    //Check if there is an existing SyncState
    try {
        const SyncState = await prisma.syncState.findUnique({
            where: {connected_account_id: account.id}
        });

        //If there is an existing sync state
        if (SyncState) {
            //Get changes to account's mailbox from last sync
            const labelMetaCache = await getLabelsPerAccount(gmail);

            let pageToken: string | undefined = undefined;
            let lastHistoryId: string | undefined = undefined;

        do {
            // Build params without including undefined fields
            const params: gmail_v1.Params$Resource$Users$History$List = {
            userId: "me",
            startHistoryId: SyncState.last_sync_token,
            historyTypes: ["messageAdded", "messageDeleted", "labelAdded", "labelRemoved"],
            maxResults: 500,
            ...(pageToken ? { pageToken } : {}), // <-- include only if defined
            };

            // Call the API
            const resp = await gmail.users.history.list(params);

            const history = resp.data.history ?? [];
            for (const h of history) {
            if (h.id) lastHistoryId = String(h.id);

            //Propogate changes to db: messagesAdded
            for (const ev of (h.messagesAdded ?? [])) {
                const mid = ev.message?.id;
                if (!mid) continue;
                const full = await fetchFullMessage(gmail, mid);
                await upsertThreadAndMessage(account, full, labelMetaCache);
            }

            //Propogate changes to db: messagesDeleted
            for (const ev of (h.messagesDeleted ?? [])) {
                const mid = ev.message?.id;
                if (!mid) continue;
                await hardDeleteMessageByProviderId(account, mid);
            }

            //Propogate changes to db: labelAdded / labelRemoved
            const handleLabelChange = async (
                ev: gmail_v1.Schema$HistoryLabelAdded | gmail_v1.Schema$HistoryLabelRemoved,
                added: boolean
            ) => {
                const mid = ev.message?.id;
                if (!mid) return;

                // find local message
                const msg = await prisma.message.findUnique({
                where: {
                    connected_account_id_provider_message_id: {
                    connected_account_id: account.id,
                    provider_message_id: mid,
                    },
                },
                select: { id: true },
                });
                if (!msg) return;

                const touchedGmailLabelIds = ev.labelIds ?? [];
                if (touchedGmailLabelIds.length === 0) return;

                // map gmail label ids -> internal label ids
                const internalIds = await mapGmailLabelsToInternalIds(account, labelMetaCache, touchedGmailLabelIds);

                if (added) {
                // add those labels
                const tx: any[] = [];
                for (const lid of internalIds) {
                    tx.push(prisma.messageLabel.upsert({
                    where: { message_id_label_id: { message_id: msg.id, label_id: lid } },
                    create: { message_id: msg.id, label_id: lid },
                    update: {},
                    }));
                }
                if (tx.length) await prisma.$transaction(tx);
                } else {
                // remove those labels
                const tx: any[] = [];
                for (const lid of internalIds) {
                    tx.push(prisma.messageLabel.deleteMany({ where: { message_id: msg.id, label_id: lid } }));
                }
                if (tx.length) await prisma.$transaction(tx);
                }

                // Maintain is_read based on UNREAD label’s presence in the event change
                if (touchedGmailLabelIds.includes("UNREAD")) {
                await prisma.message.update({
                    where: {
                    connected_account_id_provider_message_id: {
                        connected_account_id: account.id,
                        provider_message_id: mid,
                    },
                    },
                    data: { is_read: added ? false : true },
                });
                }
            };

            for (const ev of (h.labelsAdded ?? []))   await handleLabelChange(ev, true);
            for (const ev of (h.labelsRemoved ?? [])) await handleLabelChange(ev, false);
            }

            pageToken = resp.data.nextPageToken ?? undefined;
        } while (pageToken);

        //Propogate changes to db

        //Update sync state
        if (lastHistoryId) {
            const SyncState = await prisma.syncState.update({
            where: { connected_account_id: account.id },
            data: { last_sync_token: lastHistoryId, status: "IDLE", error_message: null },
            });
        } else {
            // No new history; still mark IDLE
            await prisma.syncState.update({
            where: { connected_account_id: account.id },
            data: { status: "IDLE" },
            });
        }

        //Return success syncing (incremental)
        return { ok: true, mode: "incremental" };
        }

        //First time synching
        else {
            //Get 1000 recent emails
            const labelMetaCache = await getLabelsPerAccount(gmail);
            let fetched = 0;
            let pageToken: string | undefined = undefined;
            const cap = 1000;

            do {
                // Build params WITHOUT undefined keys
                const params: gmail_v1.Params$Resource$Users$Messages$List = {
                userId: "me",
                q: "(in:inbox OR in:sent) -in:trash -in:spam",
                maxResults: Math.min(100, cap - fetched),
                ...(pageToken ? { pageToken } : {}), // include only if defined
                };

                const list = await gmail.users.messages.list(params);

                const ids = (list.data.messages ?? []).map(m => m.id!).filter(Boolean);
                if (ids.length === 0) break;

                const full = await Promise.all(ids.map(id => fetchFullMessage(gmail, id)));
                for (const msg of full) {
                if (!msg.id) continue;
                await upsertThreadAndMessage(account, msg, labelMetaCache);
                fetched++;
                }

                pageToken = list.data.nextPageToken ?? undefined;
            } while (pageToken && fetched < cap);

            //Create new sync state (seed with current historyId)
            const profile = await gmail.users.getProfile({ userId: "me" });
            const historyId = String(profile.data.historyId ?? "0");

            await prisma.syncState.create({
                data: {
                connected_account_id: account.id,
                last_sync_token: historyId,
                status: "IDLE",
                error_message: null,
                },
            });

            //Return success syncing (initial)
            return { ok: true, mode: "initial", fetched };
        }

        //Return success syncing
    } catch (err: any) {
        //Return error syncing
        // 404 (history too old) is a common Gmail case: reseed token so next run works
        if (err?.code === 404) {
        const profile = await gmail.users.getProfile({ userId: "me" });
        const historyId = String(profile.data.historyId ?? "0");
        await prisma.syncState.upsert({
            where: { connected_account_id: account.id },
            create: { connected_account_id: account.id, last_sync_token: historyId, status: "IDLE", error_message: null },
            update: { last_sync_token: historyId, status: "IDLE", error_message: null },
        });
        return { ok: true, mode: "resync_seeded" };
        }

        // Rate limit / network / 5xx → transient failure (handled: return)
        const status = err?.code ?? err?.status;
        if (status === 429 || (status >= 500 && status <= 599) || err?.message?.includes("ETIMEDOUT")) {
        await prisma.syncState.upsert({
            where: { connected_account_id: account.id },
            create: { connected_account_id: account.id, last_sync_token: "0", status: "ERROR", error_message: String(err) },
            update: { status: "ERROR", error_message: String(err) },
        });
        cmdLogger.warn("Transient sync error; suggest retry with backoff", { accountId: account.id, status });
        return { ok: false, code: "TRANSIENT", reason: String(err) };
        }

        await prisma.syncState.upsert({
        where: { connected_account_id: account.id },
        create: { connected_account_id: account.id, last_sync_token: "0", status: "ERROR", error_message: String(err) },
        update: { status: "ERROR", error_message: String(err) },
        });
        throw err;
    }
}
