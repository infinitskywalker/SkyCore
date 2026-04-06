const { activeBets } = require('../../games/raceAutoLogic');

module.exports = {
  name: 'bet',
  execute: async (message, args) => {

    // 🔍 cari race di channel ini
    const raceEntry = [...activeBets.entries()]
      .find(([_, r]) => r.open && r.channelId === message.channel.id);

    if (!raceEntry) 
      return message.reply("❌ Tidak ada race aktif atau waktu bet sudah habis!");

    const [raceId, raceData] = raceEntry;

    const choice = parseInt(args[0]);

    if (!choice || choice < 1 || choice > raceData.totalRacers)
      return message.reply(`❌ Pilih nomor antara **1 - ${raceData.totalRacers}**`);

    // ❌ HARUS DI-APPROVE
    if (!raceData.approvedPlayers.includes(message.author.id)){
      return message.reply("❌ Kamu belum di-approve oleh bandar!");
    }

    // ❌ HARUS JOIN
    if (!raceData.approvedPlayers.includes(message.author.id)){
      return message.reply("❌ Kamu belum join race!");
    }

    // ❌ racer belum keluar
    if (!raceData.racerMap){
      return message.reply("⏳ Tunggu daftar racer muncul dulu!");
    }

    const isUpdate = raceData.bets.has(message.author.id);

    raceData.bets.set(message.author.id, choice);

    const user = message.author.username;
    const racerEmoji = raceData.racerMap?.[choice] || "❓";

    return message.reply(
      isUpdate
        ? `🔁 **${user}** mengubah taruhan ke ${racerEmoji} (Racer #${choice})`
        : `🎯 **${user}** bertaruh pada ${racerEmoji} (Racer #${choice})`
    );
  }
};