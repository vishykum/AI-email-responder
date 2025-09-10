//builds the Express app (no listen)
import express from 'express';
import type {Express} from 'express';

import apiRoutes from './routes/index';

export function buildApp(): Express {
    const app = express();
    app.use('/', apiRoutes);

    return app;
}