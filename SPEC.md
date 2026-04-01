# Cloud Machine - Project Specification

## Overview
A Discord bot with web interface for uploading/downloading files through Discord, bypassing the 25MB attachment limit by splitting files into chunks.

## Architecture

```
┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  Web UI      │────▶│  Express API  │────▶│  Discord Bot │
│  (Frontend)  │     │  + SQLite     │     │  (discord.js)│
└──────────────┘     └───────────────┘     └──────────────┘
                            │                      │
                            ▼                      ▼
                     ┌──────────────┐      ┌──────────────┐
                     │  Database    │      │  Discord     │
                     │  (sql.js)    │      │  Attachments │
                     └──────────────┘      └──────────────┘
```

## Tech Stack
- **Runtime:** Node.js 18+
- **Language:** TypeScript
- **Web Server:** Express
- **Discord:** discord.js v14
- **Database:** sql.js (SQLite compiled to JS)
- **Logging:** winston
- **File Compression:** archiver

## Data Flow

### Upload
1. Web UI sends file to `/api/upload`
2. Express receives via multer (memory storage)
3. `fileHandler.processUpload()` splits file into 24MB chunks
4. Each chunk uploaded to Discord via bot
5. Metadata stored in SQLite
6. Returns File ID to user

### Download
1. User provides File ID
2. API fetches chunk locations from SQLite
3. `fileHandler.processDownload()` downloads chunks from Discord
4. Chunks concatenated in order
5. Wrapped in ZIP using archiver
6. ZIP served to user

## Database Schema

### Table: files
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID, primary key |
| original_name | TEXT | Original filename |
| total_size | INTEGER | File size in bytes |
| chunk_count | INTEGER | Number of chunks |
| mime_type | TEXT | File MIME type |
| created_at | TEXT | ISO timestamp |
| discord_message_id | TEXT | Discord message ID (optional) |

### Table: chunks
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID, primary key |
| file_id | TEXT | Foreign key to files |
| chunk_index | INTEGER | Order (0-based) |
| discord_attachment_id | TEXT | Discord attachment ID |
| discord_message_id | TEXT | Discord message ID |
| size | INTEGER | Chunk size in bytes |
| created_at | TEXT | ISO timestamp |

### Table: downloads
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID, primary key |
| file_id | TEXT | Foreign key to files |
| downloaded_at | TEXT | ISO timestamp |

## File Structure

```
src/
├── index.ts          # Express server, starts everything
├── bot.ts            # Discord bot, commands, file upload/download
├── config.ts         # Loads config.json
├── database.ts        # SQLite operations (sql.js)
├── fileHandler.ts     # Chunking, reassembly, ZIP creation
├── logger.ts         # Winston logging setup
├── types.ts          # TypeScript interfaces
└── routes/
    └── api.ts        # REST API endpoints

public/
├── index.html        # Main UI (upload, files, history tabs)
├── download.html     # Download page
├── style.css         # Vencord-inspired styles
└── app.js            # Frontend JavaScript
```

## API Endpoints

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| GET | `/api/status` | api.ts | Bot connection status |
| POST | `/api/upload` | api.ts | Upload file via multipart |
| GET | `/api/files` | api.ts | List all files |
| GET | `/api/files/:id` | api.ts | Get file metadata |
| GET | `/api/files/:id/download` | api.ts | Prepare download, creates ZIP |
| GET | `/api/files/:id/download/zip` | api.ts | Stream ZIP file |
| GET | `/api/downloads` | api.ts | Download history |
| DELETE | `/api/files/:id` | api.ts | Remove from database |

## Key Functions

### fileHandler.ts
- `processUpload(buffer, name, mime)` → Splits file, uploads to Discord, saves to DB
- `processDownload(fileId)` → Downloads chunks, concatenates, creates ZIP
- `uploadToDiscord(buffer, filename)` → Calls bot.uploadFile()
- `downloadFromDiscord(msgId, attId)` → Calls bot.downloadAttachment()

### bot.ts
- `uploadFile(buffer, filename)` → Sends attachment to Discord channel
- `downloadAttachment(msgId, attId)` → Fetches attachment from Discord
- `createFileThread(name, info)` → Creates thread for multi-chunk files
- Slash command handlers for /ping, /status, /files, etc.

### database.ts
- `initDatabase()` → Creates tables if not exist
- `createFileRecord()` / `createChunkRecord()` → Insert operations
- `getFileById()` / `getChunksByFileId()` → Query operations
- `recordDownload()` → Track download history
- `getDownloadHistory()` → Get recent downloads

## Configuration

```json
{
  "discord": {
    "token": "Bot token",
    "channelId": "Channel for file storage"
  },
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "upload": {
    "chunkSizeMB": 24,
    "maxFileSizeMB": 500
  },
  "paths": {
    "chunksDir": "./uploads/chunks",
    "tempDir": "./uploads/temp",
    "database": "./data/cloudmachine.db"
  }
}
```

## Dependencies

```json
{
  "archiver": "^6.0.1",      // ZIP creation
  "cors": "^2.8.5",          // CORS middleware
  "discord.js": "^14.14.1",   // Discord API
  "express": "^4.18.2",       // Web server
  "multer": "^1.4.5-lts.1",  // File uploads
  "sql.js": "^1.10.2",       // SQLite (pure JS)
  "uuid": "^9.0.1",          // UUID generation
  "winston": "^3.11.0"       // Logging
}
```

## Notes for Developers

1. **Background Image:** Set in `public/style.css` line 13
2. **Accent Color:** CSS variable `--accent` in `:root`
3. **Logs:** Written to `logs/cloud-machine.log`, rotated at 5MB
4. **Temp Files:** ZIP files auto-deleted after download
5. **Database:** Stored in `data/cloudmachine.db`, SQLite format
