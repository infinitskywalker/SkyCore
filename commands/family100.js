const family100Game = require('../games/family100Logic.js');
const { activeGames, disableLobbyComponents } = require('../games/family100Logic.js');
// Ganti dengan ID role yang boleh pakai command
const ALLOWED_ROLE_IDS = ["1394327915210215434", "1476816118210498642", "1486314222009712660"];

module.exports = {
  name: 'f100',
  description: 'Start a Family 100 game or close the lobby manually',
  execute: async (message, args) => {
    // Cek permission
    const hasPermission = message.member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id));
    if (!hasPermission) {
      const msg = await message.reply("⚠️ You don't have permission!");
      setTimeout(() => msg.delete().catch(()=>{}), 5000);
      return;
    }

    // Jika args[0] === "close", berarti mau close lobby
    if (args[0]?.toLowerCase() === "close") {
      const lobby = activeGames.get(message.channel.id);
      if (!lobby) return message.reply("⚠️ Tidak ada lobby aktif di channel ini!");
      // Stop collector manual
      if (lobby.collector) lobby.collector.stop("manual");
      await disableLobbyComponents(lobby.lobbyMessage);
      // Hapus dari activeGames
      activeGames.delete(message.channel.id);
      return message.channel.send("✋ Lobby ditutup secara manual oleh host!");
    }

    // Hapus command author biar ga kelihatan member lain
    message.delete().catch(()=>{});

    // Start game
    family100Game.startGame(message.channel, message.author);
  },
};