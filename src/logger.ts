import winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import { loadConfig } from './config';

const logDir = path.resolve(process.cwd(), 'logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    let log = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (stack) log += '\n' + stack;
    return log;
  })
);

const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'cloud-machine.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ]
});

export function logInfo(message: string): void {
  logger.info(message);
}

export function logError(message: string, error?: Error): void {
  logger.error(message, error);
}

export function logUpload(fileId: string, fileName: string, size: number, chunks: number): void {
  logger.info(`[UPLOAD] File ID: ${fileId} | Name: ${fileName} | Size: ${formatBytes(size)} | Chunks: ${chunks}`);
}

export function logDownload(fileId: string, fileName: string): void {
  logger.info(`[DOWNLOAD] File ID: ${fileId} | Name: ${fileName}`);
}

export function logBotCommand(command: string, user: string, guild?: string): void {
  logger.info(`[COMMAND] ${command} | User: ${user} | Guild: ${guild || 'DM'}`);
}

export function logStartup(): void {
  logger.info('='.repeat(50));
  logger.info('Cloud Machine Starting...');
  logger.info('='.repeat(50));
}

export function logShutdown(): void {
  logger.info('Cloud Machine Shutting Down...');
  logger.info('='.repeat(50));
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default logger;
