import { Router } from "express";
import type {Request, Response} from "express";
import { authenticateWithRefresh } from "../middlewares/auth.middleware";
import prisma from "../libs/prisma";
import { cmdLogger } from "../utils/logger";
import { getGmailClient } from "../utils/gmailClient";
import { decryptToken } from "../auth/tokenCrypto";
import { $Enums, ConnectedAccount } from "../../generated/prisma";

//To implemnet: Route to connect a yahoo account and handle mails