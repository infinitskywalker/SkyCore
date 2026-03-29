const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const activeGames = new Map();

// ===== Load semua pertanyaan =====
function loadQuestions() {
  const basePath = "./games/data";
  let allQuestions = {};
  const categories = fs.readdirSync(basePath);

  for (const cat of categories) {
    const catPath = path.join(basePath, cat);
    if (!fs.statSync(catPath).isDirectory()) continue;

    allQuestions[cat] = {};
    const subcats = fs.readdirSync(catPath);

    for (const sub of subcats) {
      if (!sub.endsWith(".json")) continue;
      const subPath = path.join(catPath, sub);
      const data = JSON.parse(fs.readFileSync(subPath));
      allQuestions[cat][sub.replace(".json", "")] = data;
    }
  }

  return allQuestions;
}

const questions = loadQuestions();

function getRandomPool() {
  let pool = [];
  for (const cat of Object.keys(questions)) {
    for (const sub of Object.keys(questions[cat])) {
      pool.push(...questions[cat][sub]);
    }
  }
  return pool;
}

module.exports = {
  startGame: async (channel, host) => {
    if (activeGames.has(channel.id)) return console.log("❌ Game already running");
    activeGames.set(channel.id, "starting");

    // ===== Game State =====
    let players = [];
    let selectedCategory = "Random";
    let selectedSubcategory = null;
    let totalRounds = 3;
    let selectedMode = "Normal";
    let selectedDifficulty = "easy";
    let statusText = "Menunggu pemain...";

    // ===== Embed Helper =====
    function updateLobby(embed) {
      embed.setTitle("🏁 Family 100 Lobby")
        .setColor("Random")
        .setDescription(
          `Host: <@${host.id}>
Kategori: ${selectedCategory}${selectedSubcategory ? ` → ${selectedSubcategory}` : ""}
Ronde: ${totalRounds}
Mode: ${selectedMode}
Difficulty: ${selectedDifficulty}
Status: ${statusText}

Players:
${players.map((p, i) => `#${i + 1} - <@${p.id}>`).join("\n") || "Belum ada player"}`
        );
    }

    const lobbyEmbed = new EmbedBuilder();
    updateLobby(lobbyEmbed);

    // ===== Dropdowns =====
    const categoryOptions = [{ label: "Random", value: "Random" }];
    for (const cat of Object.keys(questions)) categoryOptions.push({ label: cat, value: cat });

    
    const categoryMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_category")
        .setPlaceholder("Kategori")
        .addOptions(categoryOptions)
    );

    const subcategoryMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_subcategory")
        .setPlaceholder("SubKategori")
        .setOptions([{ label: "—", value: "none" }])
        .setDisabled(true)
    );

    const roundMenu = new ActionRowBuilder().addComponents(
  new StringSelectMenuBuilder()
    .setCustomId("select_round")
    .setPlaceholder("Ronde")
    .addOptions([
      { label: "3 Ronde", value: "3" },
      { label: "5 Ronde", value: "5" },
      { label: "7 Ronde", value: "7" },
      { label: "10 Ronde", value: "10" }
    ])
);
const modeMenu = new ActionRowBuilder().addComponents(
  new StringSelectMenuBuilder()
    .setCustomId("select_mode")
    .setPlaceholder("Mode")
    .addOptions([
      { label: "Normal", value: "Normal" },
      { label: "Fast", value: "Fast" },
      { label: "Bonus Akhir", value: "Bonus" },
      { label: "Double", value: "Double" },
      { label: "Chaos", value: "Chaos" },
      { label: "Lightning", value: "Lightning" },
      { label: "Reverse", value: "Reverse" },
      { label: "Random Mode", value: "RandomMode" }
    ])
);

    const buttonRow = new ActionRowBuilder().addComponents(
        // Tombol difficulty
      new ButtonBuilder().setCustomId("diff_easy").setLabel("Easy").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("diff_hard").setLabel("Hard").setStyle(ButtonStyle.Danger),
      // new ButtonBuilder().setCustomId("diff_random").setLabel("Random").setStyle(ButtonStyle.Secondary),

      new ButtonBuilder().setCustomId("modeInfo").setLabel("Info Mode").setStyle(ButtonStyle.Secondary),

      new ButtonBuilder().setCustomId("join").setLabel("Join").setStyle(ButtonStyle.Primary),
      // new ButtonBuilder().setCustomId("leave").setLabel("Leave").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("start").setLabel("Start").setStyle(ButtonStyle.Success)
    );

    const lobbyMsg = await channel.send({
      embeds: [lobbyEmbed],
      components: [categoryMenu, subcategoryMenu, roundMenu, modeMenu, buttonRow]
    });

    // ===== Collector =====
    const collector = lobbyMsg.createMessageComponentCollector({
      componentType: ComponentType.MessageComponent,
      time: 60000
    });

    collector.on("collect", async i => {
      // ===== JOIN =====
      if (i.customId === "join") {
        if (!players.find(p => p.id === i.user.id)) {
          players.push({ id: i.user.id, score: 0, answered: false });
          await i.reply({ content: "✅ Kamu join!", ephemeral: true });
          updateLobby(lobbyEmbed);
          await lobbyMsg.edit({ embeds: [lobbyEmbed] });

          // Auto start minimal 3 players
          if (players.length === 3) {
            statusText = "Mulai otomatis dalam 10 detik...";
            updateLobby(lobbyEmbed);
            await lobbyMsg.edit({ embeds: [lobbyEmbed] });
            setTimeout(() => collector.stop("autoStart"), 10000);
          }
        } else {
          await i.reply({ content: "⚠️ Sudah join!", ephemeral: true });
        }
      }

      // if (!i.isStringSelectMenu()) return;
      // const lobby = activeGames.get(i.channel.id);
      // lobby.selectedMode = i.values[0]; // simpan pilihan
      // i.update({ content: `✅ Mode dipilih: **${i.values[0]}**`, components: [rowWithSelect] });
      
      // ===== Info Mode & Ronde =====
      if (i.customId === "modeInfo") {
        const infoEmbed = new EmbedBuilder()
          .setTitle("ℹ️ Penjelasan Mode")
          .setDescription(
            "**Mode:**\n" +
            "🟢 Normal → Mode standar\n" +
            "⚡ Fast → Waktu per ronde lebih cepat\n" +
            "🏆 Bonus Akhir → Skor tambahan di akhir\n" +
            "💰 Double → Skor dobel\n" +
            "🔥 Chaos → Salah = skor minus\n" +
            "⚡ Lightning → Ronde cepat dan intens\n" +
            "🔄 Reverse → Jawaban dibalik/aturan unik\n" +
            "🎲 Random Mode → Mode acak tiap ronde"
          )
          .setColor("Yellow");
        await i.reply({ embeds: [infoEmbed], ephemeral: false }); // hanya user yang lihat
      }
      // ===== LEAVE =====
      if (i.customId === "leave") {
        const idx = players.findIndex(p => p.id === i.user.id);
        if (idx >= 0) {
          players.splice(idx, 1);
          await i.reply({ content: "❌ Kamu keluar!", ephemeral: true });
          updateLobby(lobbyEmbed);
          await lobbyMsg.edit({ embeds: [lobbyEmbed] });
        } else {
          await i.reply({ content: "⚠️ Kamu belum join!", ephemeral: true });
        }
      }
      // ===== DIFFICULTY =====
      if (i.customId.startsWith("diff_") && i.user.id === host.id) {
        if (i.customId === "diff_easy") selectedDifficulty = "easy";
        if (i.customId === "diff_hard") selectedDifficulty = "hard";
        if (i.customId === "diff_random") selectedDifficulty = "random";

        statusText = `Difficulty: ${selectedDifficulty}`;
        updateLobby(lobbyEmbed);
        await lobbyMsg.edit({ embeds: [lobbyEmbed] });
        await i.deferUpdate(); // Supaya tidak muncul "This interaction failed"
      }
      // ===== CATEGORY =====
      if (i.customId === "select_category" && i.user.id === host.id) {
        selectedCategory = i.values[0];
        selectedSubcategory = null;
        if (selectedCategory === "Random") {
          subcategoryMenu.components[0].setDisabled(true).setOptions([{ label: "—", value: "none" }]);
        } else {
          const opts = Object.keys(questions[selectedCategory]).map(s => ({ label: s, value: s }));
          subcategoryMenu.components[0].setDisabled(false).setOptions(opts.length ? opts : [{ label: "—", value: "none" }]);
        }
        updateLobby(lobbyEmbed);
        await lobbyMsg.edit({ embeds: [lobbyEmbed], components: [categoryMenu, subcategoryMenu, roundMenu, modeMenu, buttonRow] });
        await i.deferUpdate();
      }

      // ===== SUBCATEGORY =====
      if (i.customId === "select_subcategory" && i.user.id === host.id) {
        selectedSubcategory = i.values[0];
        updateLobby(lobbyEmbed);
        await lobbyMsg.edit({ embeds: [lobbyEmbed] });
        await i.deferUpdate();
      }

      // ===== ROUND =====
      if (i.customId === "select_round" && i.user.id === host.id) {
        totalRounds = parseInt(i.values[0]);
        updateLobby(lobbyEmbed);
        await lobbyMsg.edit({ embeds: [lobbyEmbed] });
        await i.deferUpdate();
      }

      // ===== MODE =====
      if (i.customId === "select_mode" && i.user.id === host.id) {
        selectedMode = i.values[0];
        updateLobby(lobbyEmbed);
        await lobbyMsg.edit({ embeds: [lobbyEmbed] });
        await i.deferUpdate();
      }

      // ===== START =====
      if (i.customId === "start" && i.user.id === host.id) {
        collector.stop("manualStart");
      }
    });

    collector.on("end", async () => {
      // Disable tombol
      const disabledButtons = new ActionRowBuilder().addComponents(
        buttonRow.components.map(b => ButtonBuilder.from(b).setDisabled(true))
      );
      await lobbyMsg.edit({
        components: [categoryMenu, subcategoryMenu, roundMenu, modeMenu, disabledButtons]
      });

      if (!players.length) {
        activeGames.delete(channel.id);
        return channel.send("⚠️ Tidak ada pemain!");
      }

      playGame(channel, players, selectedCategory, selectedSubcategory, totalRounds, selectedMode);
    });

    // ===== PLAY GAME =====
    async function playGame(channel, players, category, subcat, rounds, mode) {
      // ===== Pool pertanyaan =====
      let pool = [];
      if (category === "Random") pool = getRandomPool();
      else if (subcat) pool = questions[category][subcat];
      else for (const s of Object.keys(questions[category])) pool.push(...questions[category][s]);

      // ===== Tentukan flags mode =====
      const isFast = ["Fast", "Lightning"].includes(mode);
      const isDouble = ["Double"].includes(mode);
      const isBonus = ["Bonus"].includes(mode);
      const isChaos = ["Chaos"].includes(mode);
      const isReverse = ["Reverse"].includes(mode);
      const isRandomMode = ["RandomMode"].includes(mode);

      // ===== Tentukan jumlah ronde sesuai opsi ronde mainstream & antimainstream =====
      let actualRounds= parseInt(rounds);

      // ===== Loop tiap ronde =====
      for (let r = 0; r < actualRounds; r++) {
        const question = pool[Math.floor(Math.random() * pool.length)];
        const usedAnswers = [];

        // ===== Timer per ronde =====
        let timeLimit = isFast ? 10 : 15;
        if (mode === "Lightning") timeLimit = 7; // ekstra cepat
        if (isRandomMode) {
          const rand = ["Fast","Double","Chaos"];
          const randMode = rand[Math.floor(Math.random()*rand.length)];
          timeLimit = randMode === "Fast" ? 10 : 15;
          // update flags sesuai randMode
          rFlags = {
            isFast: randMode==="Fast",
            isDouble: randMode==="Double",
            isChaos: randMode==="Chaos"
          };
        }

        // ===== Embed jawaban kosong =====
        const revealEmbed = new EmbedBuilder()
          .setTitle(`❓ Ronde ${r + 1}`)
          .setDescription(`**Pertanyaan:** ${question.question}\n\n` +
            question.answers.map(() => "❌ ⌈.......⌋").join("\n"))
          .setColor("Blue")
          .setFooter({ text: `⏳ Kamu punya waktu ${timeLimit} detik. Jawaban bersifat final.` });

        const revealMsg = await channel.send({ embeds: [revealEmbed] });

        // ===== Timer interval =====
        let time = timeLimit;
        const interval = setInterval(async () => {
          time--;
          if (time <= 5) revealEmbed.setColor("Red");
          revealEmbed.setFooter({ text: `⏳ ${time} detik tersisa.\nKamu punya waktu ${timeLimit} detik. Jawaban bersifat final.` });
          await revealMsg.edit({ embeds: [revealEmbed] });
          if (time <= 0) clearInterval(interval);
        }, 1000);

        // ===== Collector jawaban =====
        const collector = channel.createMessageCollector({
          filter: m => players.find(p => p.id === m.author.id),
          time: timeLimit * 1000
        });

        collector.on("collect", m => {
          const player = players.find(p => p.id === m.author.id);
          if (player.answered) return;
          player.answered = true;

          const ans = m.content.toLowerCase();
          const match = question.answers.find(a => a.answer.toLowerCase() === ans);

          if (match && !usedAnswers.includes(ans)) {
            let score = match.score;
            if (isDouble) score *= 2;
            if (isBonus && r === actualRounds-1) score *= 2;
            if (isReverse) score *= -1; // kebalik
            player.score += score;
            usedAnswers.push(ans);

            // ===== Update embed realtime =====
            revealEmbed.setDescription(
              question.answers.map(a =>
                usedAnswers.includes(a.answer.toLowerCase())
                  ? `✅ ${a.answer} (${a.score})`
                  : "❌ ⌈.......⌋"
              ).join("\n")
            );
            revealMsg.edit({ embeds: [revealEmbed] });
            m.reply(`✅ +${score}`);
          } else {
            if (isChaos) player.score -= 10;
            if (isReverse && match) player.score -= match.score;
            m.reply("❌ Salah!");
          }
        });

        await new Promise(res => collector.on("end", res));
        clearInterval(interval);

        // ===== Reveal jawaban lengkap sekaligus =====
        const allAnswers = question.answers.map(a => `${a.answer} (${a.score})`).join(" | ");
        const finalReveal = new EmbedBuilder()
          .setTitle(`📊 Jawaban Lengkap Ronde ${r + 1}`)
          .setDescription(allAnswers)
          .setColor("Green");
        await channel.send({ embeds: [finalReveal] });

        // Reset jawaban pemain
        players.forEach(p => (p.answered = false));
      }

      // ===== Leaderboard akhir =====
      players.sort((a,b) => b.score - a.score);
      const leaderboard = players.map((p,i)=>`#${i+1} - <@${p.id}> (${p.score})`).join("\n");
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏆 Leaderboard Akhir")
            .setDescription(leaderboard)
            .setColor("Gold")
        ]
      });

      activeGames.delete(channel.id);
      console.log("🟢 GAME END");
    }
  }
};

  // // ===== Reveal Jawaban Akhir (versi satu-satu) =====
  // const reveal = new EmbedBuilder()
  //   .setTitle(`📊 Jawaban Ronde ${r + 1}`)
  //   .setColor("Blue");
  // const revealMsgg = await channel.send({ embeds: [reveal] });
  // for (let i = 0; i < question.answers.length; i++) {
  //   await new Promise(r => setTimeout(r, 800));
  //   reveal.setDescription(
  //     question.answers.slice(0, i + 1)
  //       .map(a => `✅ ${a.answer} (${a.score})`)
  //       .join("\n")
  //   );
  //   await revealMsgg.edit({ embeds: [reveal] });
  // }
