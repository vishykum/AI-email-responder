import { createLogger, transports, format } from "winston";

export const cmdLogger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
        format.colorize({all: true}),
        format.printf(({ timestamp, level, message, user_id }) => {
            return `${timestamp} ${user_id ?? 'NULL_USER'} ${level}: ${message}`;    
        })
    ),
    transports: [
        new transports.Console()
    ]
});