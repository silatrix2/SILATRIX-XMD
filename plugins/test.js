const config = require('../config');

module.exports = {
    name: 'test',
    command: 'test',
    description: 'Test command',
    async execute(bot, message, args) {
        const features = `
⚡ *SILATRIX-MD Features*

✅ Auto View Status
✅ Auto Typing  
✅ Auto Reacts Status
✅ Always Online
✅ Auto Record
✅ Auto Reply Status
✅ Anti Delete
✅ Anti Link
✅ Auto React
✅ Auto Seen Status

🔧 *Placeholders:* 
📷 Image: ${config.get('placeholders').image}
🎵 Song: ${config.get('placeholders').song}
        `.trim();

        await bot.sock.sendMessage(message.key.remoteJid, {
            text: features
        });
    }
};