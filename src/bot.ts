import { Client, GatewayIntentBits, TextChannel, Message, Attachment, ThreadChannel, APIAttachment, SlashCommandBuilder, REST, Routes, CommandInteraction } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from './config';
import { getAllFiles, getFileInfo } from './database';
import { BotStatus } from './types';
import logger, { logBotCommand, logError } from './logger';

const config = loadConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let currentServerUrl = `http://localhost:${loadConfig().server.port}`;

export function setServerUrl(url: string): void {
  currentServerUrl = url;
}

let botStatus: BotStatus = {
  connected: false,
  ready: false,
  guilds: 0,
  channel: ''
};

export function getBotStatus(): BotStatus {
  return { ...botStatus };
}

export function isBotReady(): boolean {
  return botStatus.ready;
}

async function uploadFile(buffer: Buffer, filename: string): Promise<{ messageId: string; attachmentId: string }> {
  const channel = await client.channels.fetch(config.discord.storageChannelId);
  if (!channel || !(channel instanceof TextChannel)) {
    throw new Error('Invalid channel configuration');
  }

  const attachment = { attachment: buffer, name: filename };
  const message = await channel.send({ files: [attachment] });
  const sentAttachment = message.attachments.first();

  return {
    messageId: message.id,
    attachmentId: sentAttachment?.id || ''
  };
}

async function createFileThread(threadName: string, fileInfo: any): Promise<string> {
  const channel = await client.channels.fetch(config.discord.storageChannelId);
  if (!channel || !(channel instanceof TextChannel)) {
    throw new Error('Invalid channel configuration');
  }

  const threadMessage = await channel.send(`**File Upload**\nName: ${fileInfo.original_name}\nSize: ${formatBytes(fileInfo.total_size)}\nChunks: ${fileInfo.chunk_count}\nID: \`${fileInfo.id}\``);
  
  const thread = await channel.threads.create({
    name: threadName,
    startMessage: threadMessage
  });

  return thread.id;
}

async function downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
  const channel = await client.channels.fetch(config.discord.storageChannelId);
  if (!channel || !(channel instanceof TextChannel)) {
    throw new Error('Invalid channel configuration');
  }

  const message = await channel.messages.fetch(messageId);
  const attachment = message.attachments.find(a => a.id === attachmentId);
  
  if (!attachment) {
    throw new Error('Attachment not found');
  }

  const response = await fetch(attachment.url);
  if (!response.ok) {
    throw new Error('Failed to download attachment from Discord');
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString();
}

async function registerSlashCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  const commands = [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('Check if bot is responsive'),
    new SlashCommandBuilder()
      .setName('status')
      .setDescription('Show bot status'),
    new SlashCommandBuilder()
      .setName('files')
      .setDescription('List all uploaded files'),
    new SlashCommandBuilder()
      .setName('download')
      .setDescription('Get download info for a file')
      .addStringOption(option => 
        option.setName('file_id')
          .setDescription('The file ID to download')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Show available commands'),
    new SlashCommandBuilder()
      .setName('web')
      .setDescription('Get the web interface link')
  ].map(cmd => cmd.toJSON());

  try {
    await rest.put(
      Routes.applicationCommands(client.user!.id),
      { body: commands }
    );
    logger.info('Slash commands registered successfully');
  } catch (error) {
    logError('Failed to register slash commands', error as Error);
  }
}

client.once('ready', async () => {
  logger.info(`Bot logged in as ${client.user?.tag}`);
  botStatus = {
    connected: true,
    ready: true,
    guilds: client.guilds.cache.size,
    channel: config.discord.storageChannelId
  };
  await registerSlashCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const user = interaction.user.tag;
  const guild = interaction.guild?.name;

  logBotCommand(`/${commandName}`, user, guild);

  if (commandName === 'ping') {
    await interaction.reply('Pong! Bot is online.');
    return;
  }

  if (commandName === 'status') {
    const status = getBotStatus();
    await interaction.reply(
      `**Bot Status**\n` +
      `Connected: ${status.connected ? 'Yes' : 'No'}\n` +
      `Ready: ${status.ready ? 'Yes' : 'No'}\n` +
      `Guilds: ${status.guilds}\n` +
      `Channel: ${status.channel}`
    );
    return;
  }

  if (commandName === 'files') {
    const files = getAllFiles();
    if (files.length === 0) {
      await interaction.reply('No files uploaded yet.');
      return;
    }

    const fileList = files.slice(0, 10).map((f, i) => 
      `${i + 1}. **${f.original_name}** (${formatBytes(f.total_size)}) - ID: \`${f.id}\`\n   Uploaded: ${formatDate(f.created_at)}`
    ).join('\n');

    await interaction.reply(
      `**Recent Files** (${files.length} total)\n\n${fileList}\n\n` +
      `Use \`/download <file_id>\` to get a download link.`
    );
    return;
  }

  if (commandName === 'download') {
    const fileId = interaction.options.getString('file_id', true);
    const fileInfo = getFileInfo(fileId);

    if (!fileInfo) {
      await interaction.reply('File not found. Check the file ID and try again.');
      return;
    }

    await interaction.reply(
      `**File Info**\n` +
      `Name: ${fileInfo.originalName}\n` +
      `Size: ${formatBytes(fileInfo.totalSize)}\n` +
      `Chunks: ${fileInfo.chunkCount}\n` +
      `Uploaded: ${formatDate(fileInfo.createdAt)}\n\n` +
      `Download from the web interface: ${currentServerUrl}/download/${fileId}`
    );
    return;
  }

  if (commandName === 'web') {
    await interaction.reply(
      `**Web Interface**\n` +
      `Upload files: ${currentServerUrl}/\n` +
      `Download files: ${currentServerUrl}/download/<file_id>`
    );
    return;
  }

  if (commandName === 'help') {
    await interaction.reply(
      `**Available Commands**\n\n` +
      `/ping - Check if bot is responsive\n` +
      `/status - Show bot status\n` +
      `/files - List all uploaded files\n` +
      `/download <file_id> - Get download info for a file\n` +
      `/web - Get the web interface link\n` +
      `/help - Show this help message`
    );
    return;
  }
});

client.on('messageCreate', async (message: Message) => {
  if (!message.content.startsWith('!')) return;
  if (message.author.bot) return;

  const args = message.content.slice(1).trim().split(/\s+/);
  const command = args[0]?.toLowerCase();

  logBotCommand(`!${command}`, message.author.tag, message.guild?.name);

  if (command === 'ping') {
    await message.reply('Pong! Bot is online.');
    return;
  }

  if (command === 'status') {
    const status = getBotStatus();
    await message.reply(
      `**Bot Status**\n` +
      `Connected: ${status.connected ? 'Yes' : 'No'}\n` +
      `Ready: ${status.ready ? 'Yes' : 'No'}\n` +
      `Guilds: ${status.guilds}\n` +
      `Channel: ${status.channel}`
    );
    return;
  }

  if (command === 'files') {
    const files = getAllFiles();
    if (files.length === 0) {
      await message.reply('No files uploaded yet.');
      return;
    }

    const fileList = files.slice(0, 10).map((f, i) => 
      `${i + 1}. **${f.original_name}** (${formatBytes(f.total_size)}) - ID: \`${f.id}\`\n   Uploaded: ${formatDate(f.created_at)}`
    ).join('\n');

    await message.reply(
      `**Recent Files** (${files.length} total)\n\n${fileList}\n\n` +
      `Use \`!download <file_id>\` to get a download link.`
    );
    return;
  }

  if (command === 'download') {
    const fileId = args[1];
    if (!fileId) {
      await message.reply('Usage: `!download <file_id>`');
      return;
    }

    const fileInfo = getFileInfo(fileId);
    if (!fileInfo) {
      await message.reply('File not found. Check the file ID and try again.');
      return;
    }

    await message.reply(
      `**File Info**\n` +
      `Name: ${fileInfo.originalName}\n` +
      `Size: ${formatBytes(fileInfo.totalSize)}\n` +
      `Chunks: ${fileInfo.chunkCount}\n` +
      `Uploaded: ${formatDate(fileInfo.createdAt)}\n\n` +
      `Download from the web interface: ${currentServerUrl}/download/${fileId}`
    );
    return;
  }

  if (command === 'help') {
    await message.reply(
      `**Available Commands**\n\n` +
      `\`!ping\` - Check if bot is responsive\n` +
      `\`!status\` - Show bot status\n` +
      `\`!files\` - List all uploaded files\n` +
      `\`!download <file_id>\` - Get download info for a file\n` +
      `\`!help\` - Show this help message`
    );
    return;
  }
});

client.on('error', (error) => {
  logError('Discord client error', error);
  botStatus.connected = false;
});

client.on('disconnect', () => {
  botStatus.connected = false;
  botStatus.ready = false;
});

export async function startBot(): Promise<void> {
  await client.login(config.discord.token);
}

export { uploadFile, createFileThread, downloadAttachment };

export default client;
