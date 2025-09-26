const { Boom } = require('@hapi/boom');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    makeInMemoryStore, 
    delay,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const PluginHandler = require('./utils/pluginHandler');

class SilatrixBot {
    constructor() {
        this.sock = null;
        this.store = makeInMemoryStore({});
        this.pluginHandler = new PluginHandler(this);
        this.isConnected = false;
    }

    async initialize() {
        try {
            console.log('🚀 Inaanzisha SILATRIX-MD Bot...');
            await fs.ensureDir(config.get('sessionPath'));
            await this.pluginHandler.loadPlugins();
            await this.connectToWhatsApp();
            this.startAutoFeatures();
        } catch (error) {
            console.error('Hitilafu katika kuanzisha bot:', error);
            process.exit(1);
        }
    }

    async connectToWhatsApp() {
        const { state, saveCreds } = await useMultiFileAuthState(
            path.join(config.get('sessionPath'), config.get('sessionId'))
        );

        const { version } = await fetchLatestBaileysVersion();
        
        this.sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            auth: state,
            browser: ['SILATRIX-MD', 'Chrome', '1.0.0']
        });

        this.store.bind(this.sock.ev);

        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('🔍 Tafadhali scan QR code...');
            }

            if (connection === 'open') {
                this.isConnected = true;
                console.log('✅ Bot imeunganishwa!');
                this.showBotInfo();
            }

            if (connection === 'close') {
                const shouldReconnect = 
                    (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
                
                console.log(`❌ Uunganisho umefungwa. Kurudia tena: ${shouldReconnect}`);
                
                if (shouldReconnect) {
                    this.connectToWhatsApp();
                }
            }
        });

        this.sock.ev.on('creds.update', saveCreds);
        this.sock.ev.on('messages.upsert', async (m) => {
            await this.pluginHandler.handleMessage(m);
        });
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        if (config.get('auto').antiDelete) {
            this.sock.ev.on('messages.delete', async (deleteData) => {
                await this.pluginHandler.handleAntiDelete(deleteData);
            });
        }

        this.sock.ev.on('group-participants.update', async (update) => {
            await this.pluginHandler.handleGroupUpdate(update);
        });
    }

    startAutoFeatures() {
        const auto = config.get('auto');
        
        if (auto.alwaysOnline) {
            setInterval(() => {
                if (this.sock && this.isConnected) {
                    this.sock.sendPresenceUpdate('available');
                }
            }, 60000);
        }

        console.log('⚡ Auto features zimeanzishwa...');
    }

    showBotInfo() {
        console.log('\n' + '='.repeat(50));
        console.log(`🤖 ${config.get('botName')}`);
        console.log(`👑 Mmiliki: ${config.get('owner').join(', ')}`);
        console.log(`🔧 Prefix: ${config.get('prefix')}`);
        console.log(`📦 Plugins: ${this.pluginHandler.getPluginCount()}`);
        console.log('='.repeat(50) + '\n');
    }
}

const bot = new SilatrixBot();
bot.initialize();

process.on('uncaughtException', (error) => {
    console.error('Hitilafu isiyotarajiwa:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Ahadi ilikataa:', reason);
});

module.exports = { SilatrixBot, config };