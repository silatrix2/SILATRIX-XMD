const qrcode = require('qrcode-terminal');

function showQR(qr) {
    console.clear();
    console.log('\n\n');
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║           SILATRIX-XMD BOT QR            ║');
    console.log('╠═══════════════════════════════════════════╣');
    console.log('║ SCAN QR CODE HII NA WHATSAPP YAKO        ║');
    console.log('║                                           ║');
    qrcode.generate(qr, { small: true });
    console.log('║                                           ║');
    console.log('║ Scan kwa: WhatsApp → ⋮ → Devices → Link   ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log('\n');
}

module.exports = { showQR };
