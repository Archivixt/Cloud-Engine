# Changelog

All notable changes to Cloud Machine project.

## [1.0.0] - 2026-04-01

### Added
- Discord bot with slash commands (/) and prefix commands (!)
- Web interface with three tabs: Upload, My Files, Download History
- File chunking system (splits files into 24MB chunks for Discord)
- SQLite database (sql.js) for file metadata storage
- Download history tracking (server-side)
- Activity logging with winston (logs/cloud-machine.log)
- Vencord-inspired UI with custom background image support
- Express server with REST API
- Comprehensive README and SPEC documentation

### Features
- Upload files via drag-and-drop
- Auto-split large files into Discord-safe chunks
- Download files by ID → returns ZIP
- Track upload and download history
- Glassmorphism UI design with purple accent colors

### Discord Commands
- `/ping`, `/status`, `/files`, `/download <id>`, `/web`, `/help`
- `!ping`, `!status`, `!files`, `!download <id>`, `!help`

### Tech Stack
- Node.js + TypeScript + Express
- discord.js v14
- sql.js (SQLite in JavaScript)
- winston for logging
- archiver for ZIP creation
- multer for file uploads
