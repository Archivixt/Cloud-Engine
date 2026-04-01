import * as fs from 'fs';
import * as path from 'path';
import initSqlJs, { Database } from 'sql.js';
import { loadConfig } from './config';
import { FileRecord, ChunkRecord, FileInfo } from './types';

let db: Database | null = null;
let SQL: any = null;

export async function initDatabase(): Promise<void> {
  const config = loadConfig();
  const dbPath = path.resolve(process.cwd(), config.paths.database);
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  initializeTables();
  saveDatabase();
}

function initializeTables(): void {
  if (!db) throw new Error('Database not initialized');

  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      total_size INTEGER NOT NULL,
      chunk_count INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      discord_message_id TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      discord_attachment_id TEXT NOT NULL,
      discord_message_id TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON chunks(file_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_chunks_file_index ON chunks(file_id, chunk_index)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS downloads (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      downloaded_at TEXT NOT NULL
    )
  `);
}

export function saveDatabase(): void {
  if (!db) return;
  
  const config = loadConfig();
  const dbPath = path.resolve(process.cwd(), config.paths.database);
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function createFileRecord(record: Omit<FileRecord, 'created_at'>): FileRecord {
  if (!db) throw new Error('Database not initialized');
  
  const createdAt = new Date().toISOString();
  
  db.run(
    `INSERT INTO files (id, original_name, total_size, chunk_count, mime_type, created_at, discord_message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.original_name, record.total_size, record.chunk_count, record.mime_type, createdAt, record.discord_message_id]
  );
  
  saveDatabase();
  
  return { ...record, created_at: createdAt };
}

export function createChunkRecord(record: Omit<ChunkRecord, 'created_at'>): ChunkRecord {
  if (!db) throw new Error('Database not initialized');
  
  const createdAt = new Date().toISOString();
  
  db.run(
    `INSERT INTO chunks (id, file_id, chunk_index, discord_attachment_id, discord_message_id, size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.file_id, record.chunk_index, record.discord_attachment_id, record.discord_message_id, record.size, createdAt]
  );
  
  saveDatabase();
  
  return { ...record, created_at: createdAt };
}

export function getFileById(id: string): FileRecord | null {
  if (!db) throw new Error('Database not initialized');
  
  const result = db.exec('SELECT * FROM files WHERE id = ?', [id]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  
  const row = result[0].values[0];
  return {
    id: row[0] as string,
    original_name: row[1] as string,
    total_size: row[2] as number,
    chunk_count: row[3] as number,
    mime_type: row[4] as string,
    created_at: row[5] as string,
    discord_message_id: row[6] as string | null
  };
}

export function getChunksByFileId(fileId: string): ChunkRecord[] {
  if (!db) throw new Error('Database not initialized');
  
  const result = db.exec('SELECT * FROM chunks WHERE file_id = ? ORDER BY chunk_index ASC', [fileId]);
  if (result.length === 0) return [];
  
  return result[0].values.map((row: any[]) => ({
    id: row[0] as string,
    file_id: row[1] as string,
    chunk_index: row[2] as number,
    discord_attachment_id: row[3] as string,
    discord_message_id: row[4] as string,
    size: row[5] as number,
    created_at: row[6] as string
  }));
}

export function getAllFiles(): FileRecord[] {
  if (!db) throw new Error('Database not initialized');
  
  const result = db.exec('SELECT * FROM files ORDER BY created_at DESC');
  if (result.length === 0) return [];
  
  return result[0].values.map((row: any[]) => ({
    id: row[0] as string,
    original_name: row[1] as string,
    total_size: row[2] as number,
    chunk_count: row[3] as number,
    mime_type: row[4] as string,
    created_at: row[5] as string,
    discord_message_id: row[6] as string | null
  }));
}

export function updateFileDiscordMessageId(fileId: string, messageId: string): void {
  if (!db) throw new Error('Database not initialized');
  
  db.run('UPDATE files SET discord_message_id = ? WHERE id = ?', [messageId, fileId]);
  saveDatabase();
}

export function deleteFile(id: string): boolean {
  if (!db) throw new Error('Database not initialized');
  
  db.run('DELETE FROM chunks WHERE file_id = ?', [id]);
  const result = db.run('DELETE FROM files WHERE id = ?', [id]);
  saveDatabase();
  
  return db.getRowsModified() > 0;
}

export function getFileInfo(id: string): FileInfo | null {
  const file = getFileById(id);
  if (!file) return null;

  const chunks = getChunksByFileId(id);
  
  return {
    id: file.id,
    originalName: file.original_name,
    totalSize: file.total_size,
    chunkCount: file.chunk_count,
    mimeType: file.mime_type,
    createdAt: file.created_at,
    chunks: chunks.map(c => ({
      index: c.chunk_index,
      size: c.size,
      discordMessageId: c.discord_message_id
    }))
  };
}

export function recordDownload(fileId: string): void {
  if (!db) throw new Error('Database not initialized');
  
  const { v4: uuidv4 } = require('uuid');
  const downloadId = uuidv4();
  const downloadedAt = new Date().toISOString();
  
  db.run(
    `INSERT INTO downloads (id, file_id, downloaded_at) VALUES (?, ?, ?)`,
    [downloadId, fileId, downloadedAt]
  );
  
  saveDatabase();
}

export function getDownloadHistory(limit: number = 50): { fileId: string; fileName: string; downloadedAt: string }[] {
  if (!db) throw new Error('Database not initialized');
  
  const result = db.exec(`
    SELECT d.file_id, f.original_name, d.downloaded_at 
    FROM downloads d 
    LEFT JOIN files f ON d.file_id = f.id 
    ORDER BY d.downloaded_at DESC 
    LIMIT ?
  `, [limit]);
  
  if (result.length === 0) return [];
  
  return result[0].values.map((row: any[]) => ({
    fileId: row[0] as string,
    fileName: row[1] || 'Deleted File',
    downloadedAt: row[2] as string
  }));
}
