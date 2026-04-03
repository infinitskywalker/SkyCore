const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: 'help',
  execute(message) {
const embed = new EmbedBuilder()
  .setTitle("🎮 86Core — Command List")
  .setColor(0x00AE86)

  .addFields(

    // ===== GENERAL =====
    {
      name: "⚙️ General",
      value:
        "• `!help` — lihat semua command\n" +
        "• `!ping` — cek bot aktif",
    },

    // ===== FAMILY 100 =====
    {
      name: "🧠 Family 100",
      value:
        "• `!f100` — mulai game tebak jawaban",
    },

    // ===== RACE =====
    {
      name: "🏁 Race",
      value:
        "• `!race` — mulai race biasa\n" +
        "• `!raceauto <jumlah> <mode>` — race + betting\n" +
        "• `!bet <racer>` — pilih jagoan\n" +
        "Mode:⚪ normal | ⚡ fast | 🔥 chaos\n"
    },

    // ===== BOMB =====
    {
      name: "💣 Bomb Arena",
      value:
        "• `!bomb` — mulai game bomb\n"
        // "• `pass @user` — oper bomb\n\n"+
        // "• `disarm` — oper bomb\n\n"+
        // "• `duel` — oper bomb\n\n"
    }

  )

  .setFooter({ text: "Have fun & don't panic 🚀" });
    message.reply({ embeds: [embed] });
  }
};