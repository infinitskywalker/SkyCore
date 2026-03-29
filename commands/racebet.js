const { activeBets } = require('../games/raceAutoLogic');

module.exports = {
  name: 'bet',
  execute: async (message, args) => {

    const choice = parseInt(args[0]);

    const raceEntry = [...activeBets.entries()].find(([_, r]) => r.open);

    if (!raceEntry) {
      return message.reply("❌ Tidak ada race aktif!");
    }

    const [raceId, race] = raceEntry;

    if (!choice) {
      return message.reply("Gunakan: !bet <nomor>");
    }

    if (choice < 1 || choice > race.totalRacers) {
      return message.reply("❌ Nomor tidak valid!");
    }

    race.bets.set(message.author.id, choice);

    message.reply(`✅ Kamu memilih racer #${choice}`);
  }
};