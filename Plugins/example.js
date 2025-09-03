// Example Plugin - Save this as plugins/example.js
const axios = require('axios');

module.exports = {
  name: 'Example Plugin',
  description: 'Example plugin showing various features',
  version: '1.0.0',
  author: 'SILATRIX',
  commands: ['test', 'quote', 'sticker', 'weather'],
  
  async execute(sock, msg, args, context) {
    const { sender, isGroup, isOwner, config, reply, replyWithMention } = context;
    const command = args[0] || msg.message?.conversation?.split(' ')[0]?.replace(config.PREFIX, '');
    
    switch(command) {
      case 'test':
        await reply('✅ Plugin system working perfectly!');
        break;
        
      case 'quote':
        try {
          const response = await axios.get('https://api.quotable.io/random');
          const quote = response.data;
          await reply(`💭 *Random Quote:*\n\n"${quote.content}"\n\n- ${quote.author}`);
        } catch (error) {
          await reply('❌ Could not fetch quote. Try again later.');
        }
        break;
        
      case 'sticker':
        if (msg.message?.imageMessage) {
          try {
            await sock.sendMessage(sender, {
              text: '🔄 Converting image to sticker...'
            });
            
            // Download the image
            const buffer = await sock.downloadMediaMessage(msg);
            
            // Send as sticker
            await sock.sendMessage(sender, {
              sticker: buffer
            });
          } catch (error) {
            await reply('❌ Error creating sticker: ' + error.message);
          }
        } else {
          await reply('📷 Please send an image with the command to create a sticker.');
        }
        break;
        
      case 'weather':
        if (!args[1]) {
          await reply('🌤️ Usage: .weather [city name]\nExample: .weather Dar es Salaam');
          return;
        }
        
        try {
          const city = args.slice(1).join(' ');
          // Note: You'll need to get a free API key from OpenWeatherMap
          const API_KEY = 'your_openweather_api_key';
          const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`
          );
          
          const weather = response.data;
          const weatherText = `🌤️ *Weather in ${weather.name}*\n\n` +
                            `🌡️ Temperature: ${weather.main.temp}°C\n` +
                            `🌡️ Feels like: ${weather.main.feels_like}°C\n` +
                            `💧 Humidity: ${weather.main.humidity}%\n` +
                            `☁️ Conditions: ${weather.weather[0].description}\n` +
                            `💨 Wind: ${weather.wind.speed} m/s`;
          
          await reply(weatherText);
        } catch (error) {
          await reply('❌ Could not fetch weather data. Check city name.');
        }
        break;
        
      default:
        await reply('❓ Unknown command. Use .menu to see available commands.');
    }
  }
};