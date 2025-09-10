//ambient types / Express augmentation

import {User as PrismaUser} from "@prisma/client";
import "express";

declare global {
    type DBUser = PrismaUser;

    type ClientUser = {
        first_name: string;
        last_name: string;
        display_email: string;
        password: string;
    };

    type GoogleAuthInfo = {
        provider: string;
        provider_user_id: string;
        access_token: string;
        refresh_token: string;
        token_expiry?: Date;
    };

    type GmailClientToken = {
        user_id: string;
        email_id: string;
        access_token: string;
        refresh_token: string;
        expiry_date?: number;
    };

    namespace Express {
        interface User {
            id: string;
            email:string;
            first_name?: string;
            last_name?: string;
        }
    }
}