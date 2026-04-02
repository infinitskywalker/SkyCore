const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: 'help',
  execute(message) {

    const embed = new EmbedBuilder()
      .setTitle("86Core Command List")
      .setDescription("Daftar fitur dan command yang tersedia di bot ini")
      .setColor(0x00AE86)

      // ===== GENERAL =====
      .addFields(
        {
          name: "⚙️ General",
          value:
            "`!help` → Menampilkan daftar command\n" +
            "`!ping` → Cek respon bot\n",
        },

        // ===== FAMILY 100 =====
        {
          name: "🧠 Family 100",
          value:
            "`!f100` → Memulai game Family 100\n",
        },

        // ===== RACE MANUAL =====
        {
          name: "🏁 Race",
          value:
            "`!race` → Memulai race \n",
        },

        // ===== RACE AUTO (BET) =====
        {
          name: "💰 Race Betting (Auto)",
          value:
            "`!raceauto <jumlah racer> <mode>` → Race dengan betting\n" +
            "**Contoh:**`!raceauto 5 fast`\n" +
            "`!bet <racer>` → Pilih racer untuk betting",
        },
        // ===== MODES =====
        {
          name: "🎮 Race Modes",
          value:
            "⚪ Normal → Balance\n" +
            "⚡ Fast → Satset gaspol\n" +
            "🔥 Chaos → Banyak hal-hal random, ngeboost, ngesiput, dkk\n",
        },
      )

      .setFooter({ text: "Enjoy with 86Core! 🏎️💨" });

    message.reply({ embeds: [embed] });
  }
};