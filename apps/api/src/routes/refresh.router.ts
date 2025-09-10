import {Router} from 'express';
import prisma from '../libs/prisma';
import { authenticateWithRefresh } from '../middlewares/auth.middleware';
import type {Request, Response} from 'express';
import { cmdLogger } from '../utils/logger';

const router: Router = Router();


// GET /api/refresh/revoke - Revoke all refresh tokens (Log out of all devices)
router.get("/revoke", 
    authenticateWithRefresh(),
    async (req: Request, res: Response) => {
        cmdLogger.info('Inside /api/refresh/revoke', {user_id: req.user!.id});
        try {
            //Set revoked value to all unrevoked tokens for user to true
            const refreshTokens = await prisma.refreshToken.updateMany({
            
                where: {
                    user_id: req.user!.id,
                    revoked: false
                },
                data: {
                    revoked: true
                }
            });

            cmdLogger.info(`Refresh tokens revoked for user ${req.user!.id}`, {user_id: req.user!.id});
            res.status(200).json({message: "Refresh tokens revoked"});
            
        } catch (err: any) {
            cmdLogger.error(`Failed to revoke refresh token (ERR_CODE: ${err?.code ?? 'N/A'})`, {user_id: req.user!.id});
            return res.status(500).json({error: "Failed to revoke refresh token"});
        }
    }
);


export default router;
