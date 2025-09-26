const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

class PluginHandler {
    constructor(bot) {
        this.bot = bot;
        this.plugins = new Map();
        this.commands = new Map();
    }

    async loadPlugins() {
        const pluginsDir = path.join(__dirname, '../plugins');
        
        if (!await fs.pathExists(pluginsDir)) {
            await fs.ensureDir(pluginsDir);
            await this.createDefaultPlugins();
            return;
        }

        const pluginFiles = await fs.readdir(pluginsDir);
        
        for (const file of pluginFiles) {
            if (file.endsWith('.js')) {
                try {
                    const pluginPath = path.join(pluginsDir, file);
                    const plugin = require(pluginPath);
                    
                    if (plugin.name && plugin.execute) {
                        this.plugins.set(plugin.name, plugin);
                        if (plugin.command) {
                            this.commands.set(plugin.command, plugin);
                        }
                        console.log(`✅ Plugin: ${plugin.name}`);
                    }
                } catch (error) {
                    console.error(`❌ Hitilafu: ${file}:`, error);
                }
            }
        }
        
        console.log(`📦 Plugins: ${this.plugins.size}`);
    }

    async handleMessage(m) {
        const message = m.messages[0];
        if (!message?.message) return;

        const text = message.message.conversation || 
                    message.message.extendedTextMessage?.text || 
                    '';

        if (!text.startsWith(config.get('prefix'))) return;

        const [command, ...args] = text.slice(config.get('prefix').length).split(' ');
        const plugin = this.commands.get(command);

        if (plugin) {
            try {
                await plugin.execute(this.bot, message, args);
            } catch (error) {
                console.error(`Hitilafu: ${plugin.name}:`, error);
            }
        }
    }

    async handleAntiDelete(deleteData) {
        console.log('Anti-delete:', deleteData);
    }

    async handleGroupUpdate(update) {
        console.log('Group update:', update);
    }

    getPluginCount() {
        return this.plugins.size;
    }

    async createDefaultPlugins() {
        const defaultPlugins = {
            'ping.js': `
module.exports = {
    name: 'ping',
    command: 'ping',
    description: 'Check bot response time',
    async execute(bot, message, args) {
        const start = Date.now();
        await bot.sock.sendMessage(message.key.remoteJid, { text: 'Pong! 🏓' });
        const latency = Date.now() - start;
        await bot.sock.sendMessage(message.key.remoteJid, { 
            text: \`Latency: \${latency}ms\` 
        });
    }
};`,
            'info.js': `
const config = require('../config');
module.exports = {
    name: 'info',
    command: 'info',
    description: 'Show bot information',
    async execute(bot, message, args) {
        const info = \`
🤖 *${config.get('botName')}*

👑 *Mmiliki:* ${config.get('owner').join(', ')}
🔧 *Prefix:* ${config.get('prefix')}
📦 *Plugins:* ${bot.pluginHandler.getPluginCount()}

🌐 *YouTube:* ${config.get('social').youtube}
👥 *Group:* ${config.get('social').group}
📢 *Channel:* ${config.get('social').channel}
        \`.trim();
        
        await bot.sock.sendMessage(message.key.remoteJid, { 
            text: info 
        });
    }
};`
        };

        for (const [filename, content] of Object.entries(defaultPlugins)) {
            await fs.writeFile(
                path.join(__dirname, '../plugins', filename),
                content.trim()
            );
        }

        console.log('✅ Default plugins zimetengenezwa');
        await this.loadPlugins();
    }
}

module.exports = PluginHandler;