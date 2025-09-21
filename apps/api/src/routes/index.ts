import {Router} from 'express';
import express from 'express';
import cookieParser from 'cookie-parser';
import passport from '../auth/passport';
import cors from "cors";

import healthRoutes from './health.router';
import loginRoutes from './login.router';
import refreshRoutes from './refresh.router';
import registerRoutes from './register.router';
import gmailRoutes from './gmail.router';
import aiRoutes from './ai.router';

const router: Router = Router();

router.use(cors({
    origin: process.env.CLIENT_URL!,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
}));

router.use(express.json());
router.use(express.urlencoded({extended: true}));
router.use(cookieParser());
router.use(passport.initialize());

router.use('/api/health', healthRoutes);
router.use('/api/login', loginRoutes);
router.use('/api/refresh', refreshRoutes);
router.use('/api/register', registerRoutes);
router.use('/api/gmail', gmailRoutes);
router.use('/api/ai', aiRoutes);

export default router;