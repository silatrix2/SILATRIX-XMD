const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
    jidNormalizedUser,
    downloadContentFromMessage,
    proto
} = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
const axios = require('axios');

// Load environment variables
require('dotenv').config();

// Bot Configuration from Environment Variables
const config = {
    BOT_OWNER: process.env.BOT_OWNER || "255789661031@s.whatsapp.net",
    BOT_NAME: process.env.BOT_NAME || "Silatrix Bot",
    PREFIX: process.env.PREFIX || ".",
    SESSION_ID: process.env.SESSION_ID || "silatrix_pro_bot",
    AUTO_READ: process.env.AUTO_READ !== 'false',
    PORT: process.env.PORT || 3000,
    PLATFORM: process.env.PLATFORM || 'unknown',
    AUTH_METHOD: process.env.AUTH_METHOD || 'qr',
    
    // New Auto Features
    ALWAYS_ONLINE: process.env.ALWAYS_ONLINE === 'true',
    AUTO_TYPING: process.env.AUTO_TYPING === 'true',
    AUTO_RECORD: process.env.AUTO_RECORD === 'true',
    AUTO_VIEW_STATUS: process.env.AUTO_VIEW_STATUS === 'true',
    AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS === 'true',
    AUTO_REACT: process.env.AUTO_REACT === 'true',
    AUTO_VIEW_STORY: process.env.AUTO_VIEW_STORY === 'true',
    ANTLINK: process.env.ANTLINK === 'true'
};

// Global variables
let sock;
let qrGenerated = false;
let isConnected = false;
let authMethod = config.AUTH_METHOD;
let onlineInterval;
let statusViewerInterval;

// Utility Functions
const log = (message, type = 'info') => {
    const timestamp = new Date().toLocaleString();
    const colors = {
        info: chalk.blue,
        success: chalk.green,
        warning: chalk.yellow,
        error: chalk.red,
        platform: chalk.magenta,
        pair: chalk.cyan,
        auto: chalk.greenBright
    };
    console.log(colors[type](`[${timestamp}] ${message}`));
};

// Create interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Always Online Feature
const startAlwaysOnline = () => {
    if (config.ALWAYS_ONLINE && sock) {
        log('🟢 Always Online feature activated', 'auto');
        onlineInterval = setInterval(async () => {
            try {
                await sock.sendPresenceUpdate('available');
                if (Math.random() > 0.8) {
                    await sock.sendPresenceUpdate('composing');
                    setTimeout(() => sock.sendPresenceUpdate('available'), 2000);
                }
            } catch (error) {
                log(`Always Online error: ${error.message}`, 'error');
            }
        }, 60000); // Every 1 minute
    }
};

// Auto View Status Feature
const startStatusViewer = () => {
    if (config.AUTO_VIEW_STATUS && sock) {
        log('👀 Auto View Status activated', 'auto');
        statusViewerInterval = setInterval(async () => {
            try {
                const statusUpdates = await sock.fetchStatusUpdates();
                if (statusUpdates && statusUpdates.length > 0) {
                    for (const status of statusUpdates) {
                        // Auto view status
                        await sock.readStatus(status.id);
                        
                        // Auto like if enabled
                        if (config.AUTO_LIKE_STATUS) {
                            await sock.sendMessage(status.id, {
                                react: { text: '❤️', key: status }
                            });
                        }
                        
                        log(`Viewed status from ${status.owner}`, 'auto');
                    }
                }
            } catch (error) {
                log(`Status Viewer error: ${error.message}`, 'error');
            }
        }, 300000); // Every 5 minutes
    }
};

// Auto React to Messages
const autoReact = async (msg) => {
    if (config.AUTO_REACT && sock && msg.key.fromMe === false) {
        try {
            const reactions = ['❤️', '🔥', '👍', '🎉', '😂'];
            const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
            
            await sock.sendMessage(msg.key.remoteJid, {
                react: { text: randomReaction, key: msg.key }
            });
            
            log(`Reacted with ${randomReaction} to message`, 'auto');
        } catch (error) {
            log(`Auto React error: ${error.message}`, 'error');
        }
    }
};

// Auto View Stories
const autoViewStories = async () => {
    if (config.AUTO_VIEW_STORY && sock) {
        try {
            const stories = await sock.getStories();
            if (stories && stories.length > 0) {
                for (const story of stories) {
                    await sock.readStory(story.id);
                    log(`Viewed story from ${story.owner}`, 'auto');
                    
                    // Auto like story
                    if (config.AUTO_LIKE_STATUS) {
                        await sock.sendReactionToStory(story.id, '❤️');
                    }
                }
            }
        } catch (error) {
            log(`Auto Story View error: ${error.message}`, 'error');
        }
    }
};

// Anti Link Feature
const checkAntiLink = async (msg) => {
    if (config.ANTLINK && sock && msg.key.fromMe === false) {
        try {
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urls = text.match(urlRegex);
            
            if (urls && urls.length > 0) {
                // Delete message with link
                await sock.sendMessage(msg.key.remoteJid, {
                    delete: msg.key
                });
                
                // Warn user
                await sock.sendMessage(msg.key.remoteJid, {
                    text: `⚠️ Links are not allowed here!`,
                    mentions: [msg.key.participant || msg.key.remoteJid]
                });
                
                log(`Deleted link message from ${msg.key.remoteJid}`, 'auto');
            }
        } catch (error) {
            log(`Anti Link error: ${error.message}`, 'error');
        }
    }
};

// Auto Typing Indicator
const startAutoTyping = async (msg) => {
    if (config.AUTO_TYPING && sock && msg.key.fromMe === false) {
        try {
            await sock.sendPresenceUpdate('composing', msg.key.remoteJid);
            setTimeout(() => sock.sendPresenceUpdate('available', msg.key.remoteJid), 2000);
        } catch (error) {
            log(`Auto Typing error: ${error.message}`, 'error');
        }
    }
};

// Auto Record Feature (Message Logger)
const autoRecord = async (msg) => {
    if (config.AUTO_RECORD) {
        try {
            const logData = {
                timestamp: new Date().toISOString(),
                sender: msg.key.remoteJid,
                message: msg.message,
                type: Object.keys(msg.message)[0]
            };
            
            // Save to log file
            const logFile = './chat_logs.json';
            let logs = [];
            
            if (fs.existsSync(logFile)) {
                logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
            }
            
            logs.push(logData);
            fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
            
        } catch (error) {
            log(`Auto Record error: ${error.message}`, 'error');
        }
    }
};

// Ask user to choose auth method
const askAuthMethod = () => {
    return new Promise((resolve) => {
        console.log('\n' + '='.repeat(60));
        console.log('🤖 SILATRIX BOT - CHOOSE AUTHENTICATION METHOD');
        console.log('='.repeat(60));
        console.log('1. QR Code Authentication (Default)');
        console.log('2. Pair Code Authentication');
        console.log('='.repeat(60));
        
        rl.question('Choose option (1 or 2): ', (answer) => {
            resolve(answer.trim() === '2' ? 'pair' : 'qr');
        });
    });
};

// QR Code Authentication
const startQRAuth = async () => {
    log('Starting QR Code authentication...', 'info');
    
    const sessionPath = './sessions';
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: 'silent' }),
        browser: ['SILATRIX Bot', 'Chrome', '1.0.0'],
        markOnlineOnConnect: true,
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', handleQRAuthConnection);
};

// Pair Code Authentication  
const startPairAuth = async () => {
    log('Starting Pair Code authentication...', 'pair');
    
    const sessionPath = './sessions_pair';
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: 'silent' }),
        browser: ['SILATRIX Pair', 'Chrome', '1.0.0'],
        markOnlineOnConnect: false,
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', handlePairConnection);
};

// QR Code Connection Handler
const handleQRAuthConnection = async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr && !qrGenerated) {
        qrGenerated = true;
        
        console.log('\n' + '='.repeat(65));
        console.log('📱 SILATRIX BOT - QR CODE AUTHENTICATION');
        console.log('🌐 Platform: ' + config.PLATFORM);
        console.log('⏰ QR Code Valid for 2 Minutes');
        console.log('='.repeat(65));
        
        qrcode.generate(qr, { small: true });
        
        console.log('='.repeat(65));
        log('Scan QR code quickly!', 'warning');
        
        setTimeout(() => {
            if (sock && !sock.user && !isConnected) {
                qrGenerated = false;
                console.log('\n🔄 Generating new QR code...');
                startQRAuth();
            }
        }, 120000);
    }
    
    if (connection === 'close') {
        isConnected = false;
        stopAutoFeatures();
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
            log('Connection closed, reconnecting...', 'warning');
            setTimeout(() => startQRAuth(), 3000);
        } else {
            log('Session expired. Generating new QR...', 'error');
            setTimeout(() => startQRAuth(), 5000);
        }
    } else if (connection === 'open') {
        isConnected = true;
        log('✅ Connected via QR successfully!', 'success');
        startAutoFeatures();
        startMessageHandling();
    }
};

// Pair Code Connection Handler
const handlePairConnection = async (update) => {
    const { connection, lastDisconnect, isNewLogin, qr } = update;
    
    if (isNewLogin) {
        console.log('\n' + '='.repeat(65));
        console.log('📱 SILATRIX BOT - PAIR CODE AUTHENTICATION');
        console.log('🌐 Platform: ' + config.PLATFORM);
        console.log('🔢 Check your WhatsApp for pair code notification');
        console.log('='.repeat(65));
        log('Waiting for pair code approval...', 'pair');
    }
    
    if (connection === 'close') {
        isConnected = false;
        stopAutoFeatures();
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
            log('Connection closed, reconnecting...', 'warning');
            setTimeout(() => startPairAuth(), 3000);
        } else {
            log('Pairing failed. Restarting...', 'error');
            setTimeout(() => startPairAuth(), 5000);
        }
    } else if (connection === 'open') {
        isConnected = true;
        log('✅ Connected via Pair Code successfully!', 'success');
        startAutoFeatures();
        startMessageHandling();
    }
};

// Start all auto features
const startAutoFeatures = () => {
    log('🚀 Starting all auto features...', 'auto');
    startAlwaysOnline();
    startStatusViewer();
    
    // Initial story view
    if (config.AUTO_VIEW_STORY) {
        setTimeout(autoViewStories, 10000);
    }
};

// Stop all auto features
const stopAutoFeatures = () => {
    if (onlineInterval) clearInterval(onlineInterval);
    if (statusViewerInterval) clearInterval(statusViewerInterval);
    log('Auto features stopped', 'auto');
};

// Start message handling after connection
const startMessageHandling = () => {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            await handleMessage(msg);
            await autoReact(msg);
            await startAutoTyping(msg);
            await autoRecord(msg);
            await checkAntiLink(msg);
        }
    });
    
    console.log('\n🎉 BOT IS NOW LIVE WITH AUTO FEATURES!');
    console.log('📝 Send "' + config.PREFIX + 'features" to see active features');
};

// Message Handler
const handleMessage = async (msg) => {
    try {
        if (!msg.message) return;
        
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const sender = jidNormalizedUser(msg.key.remoteJid);
        
        if (msg.key.fromMe) return;
        
        // Auto read messages
        if (config.AUTO_READ) {
            await sock.readMessages([msg.key]);
        }
        
        // Command processing
        if (text.startsWith(config.PREFIX)) {
            const args = text.slice(config.PREFIX.length).trim().split(' ');
            const command = args.shift().toLowerCase();
            
            if (command === 'ping') {
                await sock.sendMessage(sender, { text: '🏓 Pong!' });
            }
            
            if (command === 'features') {
                const features = `
🤖 ${config.BOT_NAME} - ACTIVE FEATURES
📍 Auth Method: ${authMethod.toUpperCase()}

✅ AUTO FEATURES:
• Always Online: ${config.ALWAYS_ONLINE ? '🟢' : '🔴'}
• Auto Typing: ${config.AUTO_TYPING ? '🟢' : '🔴'}  
• Auto Record: ${config.AUTO_RECORD ? '🟢' : '🔴'}
• Auto View Status: ${config.AUTO_VIEW_STATUS ? '🟢' : '🔴'}
• Auto Like Status: ${config.AUTO_LIKE_STATUS ? '🟢' : '🔴'}
• Auto React: ${config.AUTO_REACT ? '🟢' : '🔴'}
• Auto View Story: ${config.AUTO_VIEW_STORY ? '🟢' : '🔴'}
• Anti Link: ${config.ANTLINK ? '🟢' : '🔴'}

👑 Owner: wa.me/${config.BOT_OWNER.split('@')[0]}
                `;
                await sock.sendMessage(sender, { text: features });
            }
            
            if (command === 'restart' && sender === config.BOT_OWNER) {
                await sock.sendMessage(sender, { text: '🔄 Restarting bot...' });
                process.exit(0);
            }
        }
        
    } catch (error) {
        log(`Error handling message: ${error.message}`, 'error');
    }
};

// Health server for platforms
const startHealthServer = () => {
    const http = require('http');
    
    const server = http.createServer((req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                status: 'ok', 
                connected: isConnected,
                auth_method: authMethod,
                platform: config.PLATFORM,
                features: {
                    always_online: config.ALWAYS_ONLINE,
                    auto_typing: config.AUTO_TYPING,
                    auto_record: config.AUTO_RECORD,
                    auto_view_status: config.AUTO_VIEW_STATUS,
                    auto_like_status: config.AUTO_LIKE_STATUS,
                    auto_react: config.AUTO_REACT,
                    auto_view_story: config.AUTO_VIEW_STORY,
                    antilink: config.ANTLINK
                }
            }));
        } else {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('🤖 Silatrix Bot is Running...');
        }
    });
    
    server.listen(config.PORT, () => {
        log(`Health server running on port ${config.PORT}`, 'platform');
    });
};

// Main function
async function startBot() {
    try {
        console.log('\n' + '='.repeat(60));
        console.log('🤖 SILATRIX BOT - ULTIMATE AUTO FEATURES');
        console.log('='.repeat(60));
        
        // Ask for auth method if not set
        if (process.argv.includes('--qr')) {
            authMethod = 'qr';
        } else if (process.argv.includes('--pair')) {
            authMethod = 'pair';
        } else if (process.stdin.isTTY) {
            authMethod = await askAuthMethod();
        }
        
        log(`Selected authentication method: ${authMethod}`, 'info');
        
        // Start health server for platforms
        startHealthServer();
        
        // Start selected auth method
        if (authMethod === 'pair') {
            await startPairAuth();
        } else {
            await startQRAuth();
        }
        
        // Handle process exit
        process.on('SIGINT', () => {
            log('Shutting down bot...', 'warning');
            stopAutoFeatures();
            process.exit(0);
        });
        
    } catch (error) {
        log(`Error starting bot: ${error.message}`, 'error');
        setTimeout(() => startBot(), 5000);
    }
}

// Start the bot
startBot();
