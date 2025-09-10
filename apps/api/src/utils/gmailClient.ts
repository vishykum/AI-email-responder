import {google} from 'googleapis';
import { cmdLogger } from './logger';
import prisma from '../libs/prisma';
import { encryptToken } from '../auth/tokenCrypto';

export function getGmailClient(tokens: GmailClientToken) {
    const oauth2Client = new google.auth.OAuth2({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectUri: `${process.env.SERVER_URL}api/login/google/callback`
    });

    oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date ? tokens.expiry_date : null,
    });

    oauth2Client.on("tokens", async (newTokens) => {
        if (newTokens.access_token && newTokens.expiry_date) {
            cmdLogger.info("New access token generated", {user_id: tokens.user_id});

            //Save to db
            try {
                const updatedAccount = await prisma.connectedAccount.update({
                    where: {
                        email_address: tokens.email_id
                    },
                    data: {
                        access_token_encrypted: encryptToken(newTokens.access_token),
                        token_expiry: new Date(newTokens.expiry_date)
                    }
                });
            } catch(err) {
                cmdLogger.error(`Error updating access token for account (ERR: ${JSON.stringify(err)})`);
            }
        }

        if (newTokens.refresh_token) {
            cmdLogger.info("New refresh token generated", {user_id: tokens.user_id});

            //Save to db
            try {
                const updatedAccount = await prisma.connectedAccount.update({
                    where: {
                        email_address: tokens.email_id
                    },
                    data: {
                        refresh_token_encrypted: encryptToken(newTokens.refresh_token),
                    }
                });
            } catch(err) {
                cmdLogger.error(`Error updating refresh token for account (ERR: ${JSON.stringify(err)})`);
            }
        }
    });

    const gmail = google.gmail({version: "v1", auth: oauth2Client});
    return gmail;
}