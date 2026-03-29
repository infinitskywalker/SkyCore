const raceGame = require('../games/raceLogic');

// Ganti dengan ID role yang boleh pakai command
const ALLOWED_ROLE_IDS = ["1394327915210215434", "1476816118210498642", "1486314222009712660"];

module.exports = {
  name: 'race',
  description: 'Start a race (only for authorized roles, auto-delete command)',
  execute: async (message, args) => {
    // Cek permission
    const hasPermission = message.member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id));
    if (!hasPermission) {
      const msg = await message.reply("⚠️ You don't have permission to start a race!");
      // Hapus reply setelah 5 detik
      setTimeout(() => msg.delete().catch(()=>{}), 5000);
      return;
    }

    // Hapus command author biar tidak diketahui member
    message.delete().catch(()=>{});

    // Start race langsung, join lewat button
    raceGame.startRace(message.channel, message.author);
  },
};