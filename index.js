const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  MessageType,
  MessageOptions,
  Mimetype,
  jidNormalizedUser,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const chalk = require('chalk');

// Bot Configuration
const config = {
  BOT_OWNER: "255789661031@s.whatsapp.net",
  BOT_NAME: "Silatrix Bot",
  YOUTUBE: "https://youtube.com/@silatrix22",
  WHATSAPP_GROUP: "https://chat.whatsapp.com/FJaYH3HS1rv5pQeGOmKtbM",
  WHATSAPP_CHANNEL: "https://whatsapp.com/channel/0029Vb6DeKwCHDygxt0RXh0L",
  PREFIX: ".",
  SESSION_ID: "silatrix_session",
  AUTO_READ: true,
  AUTO_TYPING: false,
  WELCOME_MESSAGE: true,
  LEAVE_MESSAGE: true
};

// Global variables
let sock;
let plugins = new Map();
let commands = new Map();
let sessionCount = 0;

// Utility Functions
const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red
  };
  console.log(colors[type](`[${timestamp}] ${message}`));
};

const isOwner = (jid) => {
  return jid === config.BOT_OWNER;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Plugin System
const loadPlugins = () => {
  const pluginsDir = path.join(__dirname, 'plugins');
  
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
    log('Created plugins directory', 'info');
  }

  try {
    const pluginFiles = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));
    
    pluginFiles.forEach(file => {
      try {
        const pluginPath = path.join(pluginsDir, file);
        delete require.cache[require.resolve(pluginPath)];
        const plugin = require(pluginPath);
        
        if (plugin && plugin.name && plugin.execute) {
          plugins.set(plugin.name, plugin);
          
          if (plugin.commands) {
            plugin.commands.forEach(cmd => {
              commands.set(cmd, plugin);
            });
          }
          
          log(`Loaded plugin: ${plugin.name}`, 'success');
        }
      } catch (error) {
        log(`Error loading plugin ${file}: ${error.message}`, 'error');
      }
    });
    
    log(`Loaded ${plugins.size} plugins with ${commands.size} commands`, 'success');
  } catch (error) {
    log(`Error reading plugins directory: ${error.message}`, 'error');
  }
};

// Message Handler
const handleMessage = async (msg) => {
  try {
    if (!msg.message) return;
    
    const messageTypes = {
      conversation: msg.message.conversation,
      extendedTextMessage: msg.message.extendedTextMessage?.text,
      imageMessage: msg.message.imageMessage?.caption,
      videoMessage: msg.message.videoMessage?.caption,
      documentMessage: msg.message.documentMessage?.caption
    };
    
    const text = Object.values(messageTypes).find(t => t) || '';
    const sender = jidNormalizedUser(msg.key.remoteJid);
    const isGroup = sender.endsWith('@g.us');
    const isFromMe = msg.key.fromMe;
    
    if (isFromMe) return;
    
    // Auto read messages
    if (config.AUTO_READ) {
      await sock.readMessages([msg.key]);
    }
    
    // Auto typing indicator
    if (config.AUTO_TYPING && text.startsWith(config.PREFIX)) {
      await sock.sendPresenceUpdate('composing', sender);
      await sleep(1000);
      await sock.sendPresenceUpdate('available', sender);
    }
    
    // Command processing
    if (text.startsWith(config.PREFIX)) {
      const args = text.slice(config.PREFIX.length).trim().split(' ');
      const command = args.shift().toLowerCase();
      
      log(`Command: ${command} from ${sender}`, 'info');
      
      // Built-in commands
      if (command === 'menu' || command === 'help') {
        await sendMenu(sender);
        return;
      }
      
      if (command === 'owner') {
        await sock.sendMessage(sender, {
          text: `👑 Bot Owner: wa.me/${config.BOT_OWNER.split('@')[0]}\n\n` +
                `📱 WhatsApp Group: ${config.WHATSAPP_GROUP}\n` +
                `📢 WhatsApp Channel: ${config.WHATSAPP_CHANNEL}\n` +
                `🎥 YouTube: ${config.YOUTUBE}`
        });
        return;
      }
      
      if (command === 'ping') {
        const start = Date.now();
        await sock.sendMessage(sender, { text: 'Pinging...' });
        const end = Date.now();
        await sock.sendMessage(sender, { 
          text: `🏓 Pong!\nLatency: ${end - start}ms` 
        });
        return;
      }
      
      if (command === 'restart' && isOwner(sender)) {
        await sock.sendMessage(sender, { text: '🔄 Restarting bot...' });
        process.exit(1);
      }
      
      if (command === 'reload' && isOwner(sender)) {
        loadPlugins();
        await sock.sendMessage(sender, { 
          text: `✅ Reloaded ${plugins.size} plugins` 
        });
        return;
      }
      
      // Plugin commands
      const plugin = commands.get(command);
      if (plugin) {
        try {
          await plugin.execute(sock, msg, args, {
            sender,
            isGroup,
            isOwner: isOwner(sender),
            config,
            reply: (text) => sock.sendMessage(sender, { text }),
            replyWithMention: (text) => sock.sendMessage(sender, { 
              text,
              mentions: [sender]
            })
          });
        } catch (error) {
          log(`Error executing plugin ${plugin.name}: ${error.message}`, 'error');
          await sock.sendMessage(sender, { 
            text: `❌ Error executing command: ${error.message}` 
          });
        }
      }
    }
    
  } catch (error) {
    log(`Error handling message: ${error.message}`, 'error');
  }
};

// Menu function
const sendMenu = async (jid) => {
  const commandList = Array.from(commands.keys()).join(', ');
  const menu = `
╭─────────────────────╮
│     ${config.BOT_NAME}     │
╰─────────────────────╯

📱 *Bot Information:*
• Name: ${config.BOT_NAME}
• Owner: wa.me/${config.BOT_OWNER.split('@')[0]}
• Prefix: ${config.PREFIX}
• Plugins: ${plugins.size}
• Commands: ${commands.size}

🔧 *Built-in Commands:*
• ${config.PREFIX}menu - Show this menu
• ${config.PREFIX}ping - Check bot latency
• ${config.PREFIX}owner - Bot owner info
• ${config.PREFIX}restart - Restart bot (Owner only)
• ${config.PREFIX}reload - Reload plugins (Owner only)

🔌 *Plugin Commands:*
${commandList || 'No plugin commands loaded'}

📞 *Contact:*
• Group: ${config.WHATSAPP_GROUP}
• Channel: ${config.WHATSAPP_CHANNEL}
• YouTube: ${config.YOUTUBE}

*Powered by SILATRIX*
`;

  await sock.sendMessage(jid, { text: menu });
};

// Group event handlers
const handleGroupParticipants = async (update) => {
  try {
    const { id, participants, action } = update;
    
    if (action === 'add' && config.WELCOME_MESSAGE) {
      const welcomeText = `🎉 Welcome to the group!\n\n` +
                         `Type ${config.PREFIX}menu to see available commands.\n\n` +
                         `*${config.BOT_NAME}*`;
      
      await sock.sendMessage(id, {
        text: welcomeText,
        mentions: participants
      });
    }
    
    if (action === 'remove' && config.LEAVE_MESSAGE) {
      await sock.sendMessage(id, {
        text: `👋 Someone left the group.`
      });
    }
  } catch (error) {
    log(`Error handling group participants: ${error.message}`, 'error');
  }
};

// Connection handler with multi-session support
const handleConnection = async (update) => {
  const { connection, lastDisconnect, qr } = update;
  
  if (qr) {
    console.log('\n' + '='.repeat(50));
    console.log('📱 SCAN QR CODE WITH WHATSAPP');
    console.log('='.repeat(50));
    qrcode.generate(qr, { small: true });
    console.log('='.repeat(50));
    log(`Session ID: ${config.SESSION_ID}_${sessionCount}`, 'info');
  }
  
  if (connection === 'close') {
    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
    
    if (shouldReconnect) {
      log('Connection closed, reconnecting...', 'warning');
      sessionCount++;
      setTimeout(() => startBot(), 3000);
    } else {
      log('Bot logged out. Please scan QR code again.', 'error');
      sessionCount = 0;
      setTimeout(() => startBot(), 5000);
    }
  } else if (connection === 'open') {
    log('✅ Connected to WhatsApp successfully!', 'success');
    log(`Session: ${config.SESSION_ID}_${sessionCount}`, 'success');
    
    // Send startup message to owner
    try {
      await sock.sendMessage(config.BOT_OWNER, {
        text: `🤖 *${config.BOT_NAME}* is now online!\n\n` +
              `📊 Status: Connected\n` +
              `🔌 Plugins: ${plugins.size}\n` +
              `⚡ Commands: ${commands.size}\n` +
              `🕒 Started: ${new Date().toLocaleString()}`
      });
    } catch (error) {
      log('Could not send startup message to owner', 'warning');
    }
  } else if (connection === 'connecting') {
    log('Connecting to WhatsApp...', 'info');
  }
};

// Main bot function
async function startBot() {
  try {
    // Load plugins before starting
    loadPlugins();
    
    // Setup authentication with session support
    const sessionDir = `./sessions/${config.SESSION_ID}_${sessionCount}`;
    if (!fs.existsSync('./sessions')) {
      fs.mkdirSync('./sessions', { recursive: true });
    }
    
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();
    
    log(`Starting ${config.BOT_NAME}...`, 'info');
    log(`Session directory: ${sessionDir}`, 'info');
    
    sock = makeWASocket({
      version,
      auth: state,
      logger: P({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['SILATRIX Bot', 'Chrome', '1.0.0'],
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      defaultQueryTimeoutMs: 60000
    });

    // Event listeners
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', handleConnection);
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type === 'notify') {
        for (const msg of messages) {
          await handleMessage(msg);
        }
      }
    });
    
    sock.ev.on('group-participants.update', handleGroupParticipants);
    
    // Handle process termination
    process.on('SIGINT', async () => {
      log('Shutting down bot...', 'warning');
      if (sock) {
        await sock.end();
      }
      process.exit(0);
    });
    
  } catch (error) {
    log(`Error starting bot: ${error.message}`, 'error');
    setTimeout(() => startBot(), 5000);
  }
}

// Start the bot
log('Initializing SILATRIX Bot...', 'info');
startBot();

// Export for plugins
module.exports = {
  sock: () => sock,
  config,
  log,
  isOwner,
  sleep
};