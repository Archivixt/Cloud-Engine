export interface FileRecord {
  id: string;
  original_name: string;
  total_size: number;
  chunk_count: number;
  mime_type: string;
  created_at: string;
  discord_message_id: string | null;
}

export interface ChunkRecord {
  id: string;
  file_id: string;
  chunk_index: number;
  discord_attachment_id: string;
  discord_message_id: string;
  size: number;
  created_at: string;
}

export interface UploadResponse {
  success: boolean;
  fileId?: string;
  chunkCount?: number;
  fileName?: string;
  totalSize?: number;
  error?: string;
}

export interface DownloadResponse {
  success: boolean;
  fileName?: string;
  downloadUrl?: string;
  error?: string;
}

export interface FileInfo {
  id: string;
  originalName: string;
  totalSize: number;
  chunkCount: number;
  mimeType: string;
  createdAt: string;
  chunks: ChunkInfo[];
}

export interface ChunkInfo {
  index: number;
  size: number;
  discordMessageId: string;
}

export interface DownloadRecord {
  id: string;
  file_id: string;
  downloaded_at: string;
}

export interface BotStatus {
  connected: boolean;
  ready: boolean;
  guilds: number;
  channel: string;
}
