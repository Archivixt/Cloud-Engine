# Cloud Machine

A Discord bot with a web interface for uploading and downloading files through Discord, bypassing the 25MB attachment limit.

![Cloud Machine Banner](https://via.placeholder.com/800x200/1a1625/9d7cd8?text=Cloud+Machine)

## Features

- **Drag & Drop Upload** - Upload files via the cozy web interface
- **Auto Chunking** - Large files are automatically split into 24MB Discord-safe chunks
- **File History** - Track all uploads and downloads
- **Discord Integration** - Files stored as Discord attachments (permanent storage)
- **Download as ZIP** - Files reassembled and served as ZIP archives
- **Slash Commands** - Modern `/` commands alongside traditional `!` prefix commands
- **Activity Logging** - All uploads, downloads, and commands are logged

## Screenshots

The UI features a cozy, Vencord-inspired design with:
- Soft purple accent colors
- Glassmorphism cards with blur effects
- Smooth animations
- Background image support

## Prerequisites

- Node.js 18 or higher
- A Discord bot token
- A Discord server with a text channel for file storage

## Quick Start

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section
4. Click "Reset Token" to get your bot token (save it somewhere safe!)
5. **Important:** Scroll down to "Privileged Gateway Intents" and enable:
   - ✅ Message Content Intent
6. Add the bot to your server:
   - Go to OAuth2 > URL Generator
   - Select scopes: `bot` and `applications.commands`
   - Select permissions: `Send Messages`, `Attach Files`, `Read Message History`

### 2. Get Your Channel ID

1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click on your storage channel
3. Select "Copy Channel ID"

### 3. Configure the Bot

```bash
# Copy the example config
cp config.example.json config.json

# Edit with your details
```

Edit `config.json`:
```json
{
  "discord": {
    "token": "YOUR_BOT_TOKEN_HERE",
    "channelId": "YOUR_CHANNEL_ID_HERE"
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

### 4. Run the Bot

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start the server
npm start
```

Open http://localhost:3000 in your browser.

## How It Works

### Upload Flow
```
Your File → Split into 24MB chunks → Upload chunks to Discord → Get File ID
```

1. File is uploaded via web interface
2. File is automatically split into 24MB chunks
3. Each chunk is uploaded to Discord as an attachment
4. Metadata (file ID, chunk locations) stored in SQLite database
5. You receive a File ID to use for later retrieval

### Download Flow
```
Enter File ID → Bot fetches chunks from Discord → Reassemble → Serve as ZIP
```

1. Enter the File ID in the web interface or use Discord command
2. Bot downloads all chunks from Discord
3. Chunks are concatenated in the correct order
4. Original file is wrapped in a ZIP archive
5. ZIP is served for download

## Discord Commands

### Slash Commands (Recommended)
| Command | Description |
|---------|-------------|
| `/ping` | Check if bot is responsive |
| `/status` | Show bot status |
| `/files` | List all uploaded files |
| `/download <file_id>` | Get file info and download link |
| `/web` | Get the web interface link |
| `/help` | Show help message |

### Prefix Commands
| Command | Description |
|---------|-------------|
| `!ping` | Check if bot is responsive |
| `!status` | Show bot status |
| `!files` | List all uploaded files |
| `!download <file_id>` | Get download info for a file |
| `!help` | Show help message |

## Web Interface

The web interface is available at `http://localhost:3000` and features:

- **Upload Tab** - Drag & drop or browse for files
- **My Files Tab** - View all uploaded files with copy/download buttons
- **Download History Tab** - Server-tracked history of all downloads

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Bot connection status |
| POST | `/api/upload` | Upload a file |
| GET | `/api/files` | List all uploaded files |
| GET | `/api/files/:id` | Get file metadata |
| GET | `/api/files/:id/download` | Prepare download |
| GET | `/api/files/:id/download/zip` | Download ZIP file |
| GET | `/api/downloads` | Download history |
| DELETE | `/api/files/:id` | Remove file from database |

## Activity Logs

All activities are logged to `logs/cloud-machine.log`:
- Server startup/shutdown
- File uploads with details
- File downloads with details
- Discord commands used
- Errors and exceptions

Logs are rotated automatically (max 5 files, 5MB each).

## File Structure

```
cloud-machine/
├── config.json          # Configuration (create from config.example.json)
├── config.example.json  # Example configuration
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md
├── SPEC.md              # Project specification
├── src/
│   ├── index.ts         # Express server entry point
│   ├── bot.ts           # Discord bot
│   ├── config.ts        # Configuration loader
│   ├── database.ts      # SQLite operations
│   ├── fileHandler.ts   # File chunking/reassembly
│   ├── logger.ts        # Winston logging
│   ├── types.ts         # TypeScript interfaces
│   └── routes/
│       └── api.ts       # API routes
├── public/              # Frontend files
│   ├── index.html       # Upload page
│   ├── download.html    # Download page
│   ├── style.css        # Styles
│   └── app.js           # Frontend JavaScript
├── uploads/             # Temporary file storage
│   ├── chunks/          # Uploaded chunks (gitignored)
│   └── temp/            # Temporary ZIP files (gitignored)
├── data/                # Database
│   └── cloudmachine.db  # SQLite database (gitignored)
└── logs/                # Activity logs (gitignored)
    └── cloud-machine.log
```

## Customization

### Change Background Image

Edit `public/style.css`, line 13:
```css
body {
  background: url('file:///PATH/TO/YOUR/IMAGE.png') center/cover no-repeat fixed;
  /* ... */
}
```

### Change Accent Color

Edit `public/style.css`, the `:root` section:
```css
:root {
  --accent: #9d7cd8;        /* Change this hex color */
  --accent-hover: #b8a9e8;
  --accent-muted: #6e5a9e;
  /* ... */
}
```

## Troubleshooting

### Bot says "Bot not ready"
- Check your Discord token is correct in `config.json`
- Ensure the bot has been added to your server
- Check the bot has the required permissions

### Upload fails
- Ensure the bot is in the configured channel
- Check your internet connection
- Verify the channel ID is correct

### Can't download file
- The file chunks may have been deleted from Discord
- Try the download again - ZIP files are temporary

## License

MIT License - feel free to use and modify!

## Contributing

Contributions welcome! Please open an issue or pull request.
