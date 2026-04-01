import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as path from 'path';
import { loadConfig } from './config';
import { initDatabase } from './database';
import apiRoutes from './routes/api';
import { startBot } from './bot';
import { setDiscordBot } from './fileHandler';
import logger, { logStartup, logShutdown, logError } from './logger';

async function main() {
  const config = loadConfig();
  logStartup();
  
  await initDatabase();
  logger.info('Database initialized');

  const app: Express = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  app.use('/api', apiRoutes);

  app.get('/', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  app.get('/download/:fileId', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/download.html'));
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logError('Unhandled server error', err);
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Internal server error' 
    });
  });

  try {
    const bot = await startBot();
    setDiscordBot(bot);
    
    app.listen(config.server.port, config.server.host, () => {
      logger.info(`Server running at http://${config.server.host}:${config.server.port}`);
      logger.info('Discord bot is ready');
      logger.info('Cloud Machine is fully operational!');
    });
  } catch (error) {
    logError('Failed to start application', error as Error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  logShutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logShutdown();
  process.exit(0);
});

main();
