import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig, getMaxFileSizeBytes } from '../config';
import { getAllFiles, getFileInfo, deleteFile as dbDeleteFile, recordDownload, getDownloadHistory } from '../database';
import { processUpload, processDownload, getZipPath, cleanupTempFile } from '../fileHandler';
import { getBotStatus, isBotReady } from '../bot';
import logger, { logInfo } from '../logger';

const router = Router();
const config = loadConfig();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: getMaxFileSizeBytes()
  }
});

router.get('/status', (_req: Request, res: Response) => {
  const status = getBotStatus();
  res.json({
    success: true,
    ...status,
    message: status.ready ? 'All systems operational' : 'Bot is not ready'
  });
});

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file provided' });
    return;
  }

  if (!isBotReady()) {
    res.status(503).json({ success: false, error: 'Discord bot is not ready' });
    return;
  }

  logger.info(`[WEB] Upload request received: ${req.file.originalname} (${req.file.size} bytes)`);

  const result = await processUpload(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype
  );

  if (result.success) {
    logger.info(`[WEB] Upload successful: ${result.fileId} - ${result.fileName}`);
    res.json(result);
  } else {
    logger.error(`[WEB] Upload failed: ${result.error}`);
    res.status(500).json(result);
  }
});

router.get('/files', (_req: Request, res: Response) => {
  const files = getAllFiles();
  res.json({
    success: true,
    count: files.length,
    files: files.map(f => ({
      id: f.id,
      originalName: f.original_name,
      totalSize: f.total_size,
      chunkCount: f.chunk_count,
      createdAt: f.created_at
    }))
  });
});

router.get('/downloads', (_req: Request, res: Response) => {
  const history = getDownloadHistory();
  res.json({
    success: true,
    count: history.length,
    downloads: history
  });
});

router.get('/files/:id', (req: Request, res: Response) => {
  const fileInfo = getFileInfo(req.params.id);
  
  if (!fileInfo) {
    res.status(404).json({ success: false, error: 'File not found' });
    return;
  }

  res.json({
    success: true,
    ...fileInfo
  });
});

router.get('/files/:id/download', async (req: Request, res: Response) => {
  if (!isBotReady()) {
    res.status(503).json({ success: false, error: 'Discord bot is not ready' });
    return;
  }

  recordDownload(req.params.id);
  const result = await processDownload(req.params.id);

  if (result.success) {
    logger.info(`[WEB] Download prepared: ${req.params.id}`);
    res.json(result);
  } else {
    logger.error(`[WEB] Download failed: ${req.params.id} - ${result.error}`);
    res.status(404).json(result);
  }
});

router.get('/files/:id/download/zip', (req: Request, res: Response) => {
  const zipPath = getZipPath(req.params.id);

  if (!zipPath) {
    const result = processDownload(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, error: 'File not found. Please request download first.' });
      return;
    }
  }

  const zipPathFinal = getZipPath(req.params.id);
  if (!zipPathFinal) {
    res.status(404).json({ success: false, error: 'Download file expired. Please request again.' });
    return;
  }

  const fileInfo = getFileInfo(req.params.id);
  const filename = fileInfo ? `${fileInfo.originalName}.zip` : `${req.params.id}.zip`;

  logger.info(`[WEB] ZIP downloaded: ${req.params.id} - ${filename}`);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  const fileStream = fs.createReadStream(zipPathFinal);
  fileStream.pipe(res);

  fileStream.on('end', () => {
    cleanupTempFile(req.params.id);
  });
});

router.delete('/files/:id', (req: Request, res: Response) => {
  const deleted = dbDeleteFile(req.params.id);

  if (deleted) {
    cleanupTempFile(req.params.id);
    res.json({ success: true, message: 'File removed from database' });
  } else {
    res.status(404).json({ success: false, error: 'File not found' });
  }
});

export default router;
