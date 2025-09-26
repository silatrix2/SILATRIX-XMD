const fs = require('fs');
const path = require('path');

class Config {
    constructor() {
        this.loadEnv();
        this.config = {
            owner: process.env.BOT_OWNER?.split(',').map(num => num.trim() + '@s.whatsapp.net') || [],
            botName: process.env.BOT_NAME || 'Silatrix Bot',
            prefix: process.env.PREFIX || '.',
            sessionId: process.env.SESSION_ID || 'POPKID;;;GcsUwAYY#fFLqK2b5eB5uaRyPLSrG60194km1WLFUE6817VjvzKc',
            sessionPath: process.env.SESSION_PATH || './sessions/',
            social: {
                youtube: process.env.YOUTUBE,
                group: process.env.WHATSAPP_GROUP,
                channel: process.env.WHATSAPP_CHANNEL
            },
            auto: {
                viewStatus: process.env.AUTO_VIEW_STATUS === 'true',
                typing: process.env.AUTO_TYPING === 'true',
                reactsStatus: process.env.AUTO_REACTS_STATUS === 'true',
                alwaysOnline: process.env.ALWAYS_ONLINE === 'true',
                record: process.env.AUTO_RECORD === 'true',
                replyStatus: process.env.AUTO_REPLY_STATUS === 'true',
                antiDelete: process.env.ANTI_DELETE === 'true',
                antiLink: process.env.ANTI_LINK === 'true',
                autoReact: process.env.AUTO_REACT === 'true',
                autoSeenStatus: process.env.AUTO_SEEN_STATUS === 'true'
            },
            placeholders: {
                image: process.env.BOT_IMAGE,
                song: process.env.BOT_SONG
            }
        };
    }

    loadEnv() {
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            require('dotenv').config();
        }
    }

    get(key) {
        return this.config[key];
    }
}

module.exports = new Config();