import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig, getChunkSizeBytes } from './config';
import { getChunksByFileId, getFileById, createChunkRecord, createFileRecord } from './database';
import { ChunkRecord, UploadResponse, DownloadResponse } from './types';
import logger, { logUpload, logDownload, logError } from './logger';

let discordBot: any = null;

export function setDiscordBot(bot: any): void {
  discordBot = bot;
}

export async function uploadToDiscord(buffer: Buffer, filename: string): Promise<{ messageId: string; attachmentId: string }> {
  if (!discordBot) {
    throw new Error('Discord bot not initialized');
  }
  return discordBot.uploadFile(buffer, filename);
}

export async function downloadFromDiscord(messageId: string, attachmentId: string): Promise<Buffer> {
  if (!discordBot) {
    throw new Error('Discord bot not initialized');
  }
  return discordBot.downloadAttachment(messageId, attachmentId);
}

export async function processUpload(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<UploadResponse> {
  try {
    const config = loadConfig();
    const chunkSize = getChunkSizeBytes();
    const fileId = uuidv4();
    
    const chunks: Buffer[] = [];
    let offset = 0;
    
    while (offset < fileBuffer.length) {
      const end = Math.min(offset + chunkSize, fileBuffer.length);
      chunks.push(fileBuffer.slice(offset, end));
      offset = end;
    }
    
    const chunksDir = path.resolve(process.cwd(), config.paths.chunksDir);
    const uploadedChunks: { localPath: string; index: number }[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkFilename = `${fileId}_part${i + 1}.bin`;
      const chunkPath = path.join(chunksDir, chunkFilename);
      fs.writeFileSync(chunkPath, chunks[i]);
      uploadedChunks.push({ localPath: chunkPath, index: i });
    }
    
    const fileRecord = createFileRecord({
      id: fileId,
      original_name: originalName,
      total_size: fileBuffer.length,
      chunk_count: chunks.length,
      mime_type: mimeType,
      discord_message_id: null
    });
    
    const threadName = `${originalName} (${fileId.substring(0, 8)})`;
    
    for (const chunk of uploadedChunks) {
      const chunkData = fs.readFileSync(chunk.localPath);
      const ext = path.extname(originalName);
      const chunkName = `${fileId}_part${chunk.index + 1}${ext}`;
      
      const discordInfo = await uploadToDiscord(chunkData, chunkName);
      
      createChunkRecord({
        id: uuidv4(),
        file_id: fileId,
        chunk_index: chunk.index,
        discord_attachment_id: discordInfo.attachmentId,
        discord_message_id: discordInfo.messageId,
        size: chunkData.length
      });
      
      fs.unlinkSync(chunk.localPath);
    }
    
    if (uploadedChunks.length > 1) {
      await discordBot.createFileThread(threadName, fileRecord);
    }
    
    logUpload(fileId, originalName, fileBuffer.length, chunks.length);
    
    return {
      success: true,
      fileId,
      chunkCount: chunks.length,
      fileName: originalName,
      totalSize: fileBuffer.length
    };
  } catch (error) {
    logError('Upload processing error', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during upload'
    };
  }
}

export async function processDownload(fileId: string): Promise<DownloadResponse> {
  try {
    const file = getFileById(fileId);
    if (!file) {
      return { success: false, error: 'File not found' };
    }

    const chunks = getChunksByFileId(fileId);
    if (chunks.length === 0) {
      return { success: false, error: 'No chunks found for file' };
    }

    chunks.sort((a, b) => a.chunk_index - b.chunk_index);

    const config = loadConfig();
    const tempDir = path.resolve(process.cwd(), config.paths.tempDir);
    const tempFiles: string[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkBuffer = await downloadFromDiscord(chunk.discord_message_id, chunk.discord_attachment_id);
      const tempPath = path.join(tempDir, `${fileId}_chunk_${i}`);
      fs.writeFileSync(tempPath, chunkBuffer);
      tempFiles.push(tempPath);
    }

    const outputBuffer = Buffer.concat(
      tempFiles.map(f => fs.readFileSync(f))
    );

    tempFiles.forEach(f => fs.unlinkSync(f));

    const zipPath = path.join(tempDir, `${fileId}_${file.original_name}.zip`);
    const zipStream = fs.createWriteStream(zipPath);
    
    await new Promise<void>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 0 } });
      
      zipStream.on('close', () => resolve());
      archive.on('error', reject);
      
      archive.pipe(zipStream);
      archive.append(outputBuffer, { name: file.original_name });
      archive.finalize();
    });

    return {
      success: true,
      fileName: `${file.original_name}.zip`,
      downloadUrl: `/api/files/${fileId}/download/zip`
    };
  } catch (error) {
    logError('Download processing error', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during download'
    };
  }
}

export function getZipPath(fileId: string): string | null {
  const file = getFileById(fileId);
  if (!file) return null;

  const config = loadConfig();
  const zipPath = path.resolve(process.cwd(), config.paths.tempDir, `${fileId}_${file.original_name}.zip`);
  
  if (!fs.existsSync(zipPath)) return null;
  
  return zipPath;
}

export function cleanupTempFile(fileId: string): void {
  const config = loadConfig();
  const file = getFileById(fileId);
  if (!file) return;

  const zipPath = path.resolve(process.cwd(), config.paths.tempDir, `${fileId}_${file.original_name}.zip`);
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
}
