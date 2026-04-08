const {EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder } = require("discord.js");

const fs = require("fs");
const path = require("path");

const activeGames = new Map();
module.exports.activeGames = activeGames;

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // hapus simbol
    .trim();
}

function similarity(a, b) {
  // simple similarity (Levenshtein ringan)
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  let same = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer[i] === shorter[i]) same++;
  }

  return same / longer.length;
}

function isAnswerMatch(input, answer) {
  input = normalize(input);
  answer = normalize(answer);

  const inputWords = input.split(" ");
  const answerWords = answer.split(" ");

  const answerLen = answerWords.length;

  // hitung kata yang sama
  let matchCount = 0;
  for (const word of answerWords) {
    if (inputWords.includes(word)) matchCount++;
  }

  // RULE
  if (answerLen >= 3) {
    return matchCount >= 2;
  } else if (answerLen === 2) {
    return matchCount >= 1;
  } else if (answerLen === 1) {
    return similarity(input, answer) >= 0.80;
  }

  return false;
}
async function disableLobbyComponents(lobbyMsg) {
  if (!lobbyMsg) return;

  // Map semua ActionRow dan komponen di dalamnya
  const disabledComponents = lobbyMsg.components.map(row => {
    return {
      type: row.type,
      components: row.components.map(comp => {
        return {
          ...comp.toJSON(),
          disabled: true // ❌ disable semua
        }
      })
    }
  });

  await lobbyMsg.edit({ components: disabledComponents }).catch(() => {});
}
// ===== Load semua pertanyaan =====
function loadQuestions() {
  const basePath = "./games/data";
  let allQuestions = {};

  const files = fs.readdirSync(basePath);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const filePath = path.join(basePath, file);
    const data = JSON.parse(fs.readFileSync(filePath));
    if (!Array.isArray(data)) continue;

    for (const q of data) {
      const cat = q.category || "Lainnya"; // fallback kalau ga ada

      if (!allQuestions[cat]) allQuestions[cat] = [];
      allQuestions[cat].push(q);
    }
  }
  //   const categoryName = file.replace(".json", "");
  //   allQuestions[categoryName] = data; // langsung array pertanyaan
  // }

  return allQuestions;
}

const questions = loadQuestions();

function getRandomPool() {
  let pool = [];
  for (const cat of Object.keys(questions)) {
    pool.push(...questions[cat]); // ga ada subcategory
    // for (const sub of Object.keys(questions[cat])) {
    //   pool.push(...questions[cat][sub]);
    // }
  }
  return pool;
}

const startGame = async (channel, host) => {
  if (activeGames.has(channel.id)) return channel.send("❌ Game already running");
  activeGames.set(channel.id, "starting");

  // ===== Game State =====
  let players = [];
  let selectedCategory = "Random";
  // let selectedSubcategory = null;
  let totalRounds = 3;
  let selectedMode = "Normal";
  let selectedDifficulty = "easy";
  let statusText = "Menunggu pemain...";

  // 🗂️ Kategori: ${selectedCategory}${selectedSubcategory ? ` → ${selectedSubcategory}` : ""}
      // ===== Helper untuk menu dan embed =====
      function updateLobby(embed) {
        embed
          .setTitle("🏁 Family 100 Lobby")
          .setColor("Random")
          .setDescription(
            `**👤 Host: <@${host.id}>
  🗂️ Kategori: ${selectedCategory}
  🎯 Ronde: ${totalRounds}
  🕹️ Mode: ${selectedMode}
  🔰 Difficulty: ${selectedDifficulty}
  📊 Status: ${statusText}

  Players:
  ${players.map((p,i)=>`#${i+1} - <@${p.id}>`).join("\n") || "Belum ada player"}**`
      );
  }

  function categoryMenu() {
    const options = [{ label: "Random", value: "Random", default: selectedCategory === "Random" }];
    for (const cat of Object.keys(questions)) options.push({ label: cat, value: cat, default: selectedCategory===cat });
    return new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_category")
        .setPlaceholder("Kategori")
        .addOptions(options)
    );
  }


  function modeMenu() {
    const modes = ["Normal","Fast","Bonus","Double","Chaos","Lightning","Reverse","RandomMode"];
    const options = modes.map(m => ({ label: m, value: m, default: selectedMode===m }));
    return new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_mode")
        .setPlaceholder("Mode")
        .addOptions(options)
    );
  }

  function buttonRow() {
    const isHard = selectedDifficulty==="hard";
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("toggle_level").setLabel(isHard?"🔴 Hard":"🟢 Easy").setStyle(ButtonStyle.Primary),
        // .setStyle(isHard?ButtonStyle.Danger:ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("cycle_round").setLabel(`🎯 Ronde: ${totalRounds}`).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("mode_info").setLabel("ℹ️ Info Mode").setStyle(ButtonStyle.Secondary)
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("toggle_join").setLabel("🎮 Join / Leave").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("start_game").setLabel("🚀 Start").setStyle(ButtonStyle.Danger)
    );
    return [row1,row2];
  }
  // ===== Send lobby =====
  const lobbyEmbed = new EmbedBuilder().setTitle("🏁 Family 100 Lobby").setColor("Random").setDescription("Menunggu pemain...");
  const lobbyMsg = await channel.send({ embeds:[lobbyEmbed], components:[categoryMenu(), /* subcategoryMenu(), */ modeMenu(), ...buttonRow()] });

  async function renderLobby() {
    updateLobby(lobbyEmbed);
    await lobbyMsg.edit({ embeds:[lobbyEmbed], components:[categoryMenu(), /* subcategoryMenu(), */ modeMenu(), ...buttonRow()] });
  }

  // ===== Collector =====
  const lobbyCollector = lobbyMsg.createMessageComponentCollector({ componentType: ComponentType.MessageComponent, time:60000*5 });
  lobbyCollector.on("end", async (collected, reason) => {
    if (reason === "time") {
      // Respon saat tutup otomatis
      await channel.send("⏰ Lobby ditutup otomatis karena tidak ada interaksi.(5 menit)");
    }

  await disableLobbyComponents(lobbyMsg);
    if (!players.length) {
      statusText = "⚠️ Belum ada pemain! Lobby tetap menunggu...";
      await renderLobby();
      return;
    }

    await playGame(channel, players, selectedCategory, null, totalRounds, selectedMode);
  });
  lobbyCollector.on("collect", async i=>{
    if (!i.isButton() && !i.isStringSelectMenu()) return;

    // ===== Join / Leave =====
    if (i.customId==="toggle_join") {
      const idx = players.findIndex(p=>p.id===i.user.id);
      if (idx>=0) {
        players.splice(idx,1);
        await i.reply({ content:"❌ Kamu keluar!", flags: 64  });
      } else {
        players.push({ id:i.user.id, score:0, answered:false });
        await i.reply({ content:"✅ Kamu join!", flags: 64  });
      }
  // ===== Update statusText =====
    statusText = players.length
    ? `${players.length} pemain siap`
    : "Menunggu pemain...";
      await renderLobby();
      return;
    }

    // ===== Toggle Difficulty =====
    if (i.customId==="toggle_level" && i.user.id===host.id) {
      selectedDifficulty = selectedDifficulty==="easy"?"hard":"easy";
      await renderLobby();
      await i.deferUpdate();
      return;
    }

    // ===== Cycle Round =====
    if (i.customId==="cycle_round" && i.user.id===host.id) {
      const rounds = [3,5,7,10];
      let idx = rounds.indexOf(totalRounds);
      totalRounds = rounds[(idx+1)%rounds.length];
      await renderLobby();
      await i.deferUpdate();
      return;
    }

    // ===== Info Mode =====
    if (i.customId==="mode_info") {
      const infoEmbed = new EmbedBuilder()
        .setTitle("ℹ️ Penjelasan Mode")
        .setColor("Yellow")
        .setDescription(
          "🟢 Normal → Mode standar\n" +
          "⚡ Fast → Waktu per ronde lebih cepat\n" +
          "🏆 Bonus → Skor tambahan di akhir\n" +
          "💰 Double → Skor dobel\n" +
          "🔥 Chaos → Salah = skor minus\n" +
          "⚡ Lightning → Ronde cepat dan intens\n" +
          "🔄 Reverse → Jawaban dibalik/aturan unik\n" +
          "🎲 Random Mode → Mode acak tiap ronde"
        );
      await i.reply({ embeds:[infoEmbed], ephemeral:true });
      return;
    }

    // ===== Category =====
    if (i.customId==="select_category" && i.user.id===host.id) {
      selectedCategory = i.values[0];
      // selectedSubcategory=null;
      await renderLobby();
      await i.deferUpdate();
      return;
    }
    // ===== Mode =====
    if (i.customId==="select_mode" && i.user.id===host.id) {
      selectedMode=i.values[0];
      await renderLobby();
      await i.deferUpdate();
      return;
    }

    // ===== Start Game =====
    if (i.customId==="start_game" && i.user.id===host.id) {
      if (!players.length) {
        await i.reply({ content: "⚠️ Tidak ada pemain! Tambahkan minimal 1 pemain untuk mulai.", ephemeral: true });
        return;
      }
      lobbyCollector.stop("manualStart");
      // return;
    }
  });


  // ===== PLAY GAME =====
  async function playGame(channel, players, category, subcat, rounds, mode) {
    let pool=[];
    if (category === "Random") {
      pool = getRandomPool(); // ambil dari semua kategori
    } else if (Array.isArray(questions[category])) {
      pool = [...questions[category]]; // langsung copy array
    }
    // else if(subcat && questions[category][subcat]) pool=questions[category][subcat];
    // else for(const s of Object.keys(questions[category]||{})) pool.push(...questions[category][s]);
    if (!players.length) {statusText = "⚠️ Belum ada pemain! Lobby tetap menunggu...";
      await renderLobby();
      return;
    }
      if (!pool.length) return channel.send("⚠️ Tidak ada pertanyaan di kategori ini!");

    const isFast = ["Fast","Lightning"].includes(mode);
    const isDouble = ["Double"].includes(mode);
    const isBonus = ["Bonus"].includes(mode);
    const isChaos = ["Chaos"].includes(mode);
    const isReverse = ["Reverse"].includes(mode);

    for (let r=0;r<rounds;r++){
      const question = pool[Math.floor(Math.random()*pool.length)];
      if(!question || !question.answers || !question.answers.length) continue;
      const usedAnswers=[];

      let timeLimit = isFast?10:15;
      if(mode==="Lightning") timeLimit=7;

      const revealEmbed = new EmbedBuilder()
        .setTitle(`❓ Ronde ${r+1}`)
        .setDescription(`${question.question}\n` + question.answers.map(()=> "❌ ⌈.......⌋").join("\n"))
        .setColor("Blue")
        .setFooter({ text:`⏳ Kamu punya waktu ${timeLimit} detik. Jawaban bersifat final.` });

      const revealMsg = await channel.send({ embeds:[revealEmbed] });

      let time = timeLimit;
      const interval = setInterval(async ()=>{
        time--;
        if(time<=5) revealEmbed.setColor("Red");
        revealEmbed.setFooter({ text:`⏳ ${time} detik tersisa.` });
        await revealMsg.edit({ embeds:[revealEmbed] });
        if(time<=0) clearInterval(interval);
      },1000);

      const answerCollector = channel.createMessageCollector({
        filter: m=>players.some(p=>p.id===m.author.id),
        time:timeLimit*1000
      });

      answerCollector.on("collect", m=>{
        const player = players.find(p=>p.id===m.author.id);
        if(!player || player.answered) return;
        player.answered=true;
        const ans=m.content.toLowerCase();
        // const match = question.answers.find(a=>a.answer.toLowerCase()===ans);
        
      const ansNormalized = ans.toLowerCase().trim();
      const matchedAnswer = question.answers.find(a => isAnswerMatch(ansNormalized, a.answer));
      if (matchedAnswer && !usedAnswers.includes(matchedAnswer.answer.toLowerCase())) {
        let score = matchedAnswer.score;
        if (isDouble) score *= 2;
        if (isBonus && r === rounds-1) score *= 2;
        if (isReverse) score *= -1;
        player.score += score;
        usedAnswers.push(matchedAnswer.answer.toLowerCase());
        revealEmbed.setDescription(
          question.answers
            .map(a => usedAnswers.includes(a.answer.toLowerCase()) ? `✅ ${a.answer} (${a.score})` : "❌ ⌈.......⌋")
            .join("\n")
        );
        revealMsg.edit({ embeds: [revealEmbed] });
        m.reply(`✅ +${score} : ${matchedAnswer.answer}`);
      } else {
          if(isChaos) player.score-=10;
          if(isReverse && matchedAnswer) player.score-=matchedAnswer.score;
          m.reply("❌ Salah!");
        }
      });

      await new Promise(res=>answerCollector.on("end",res));
      clearInterval(interval);

      const allAnswers = question.answers.map(a=>`${a.answer} (${a.score})`).join(" | ");
      const finalReveal = new EmbedBuilder()
        .setTitle(`📊 Jawaban Lengkap Ronde ${r+1}`)
        .setDescription(allAnswers)
        .setColor("Green");
      await channel.send({ embeds:[finalReveal] });
      players.forEach(p=>p.answered=false);
    }

    // ===== Leaderboard =====
    players.sort((a,b)=>b.score-a.score);
    const leaderboard = players.map((p,i)=>`#${i+1} - <@${p.id}> (${p.score})`).join("\n");
    await channel.send({ embeds:[ new EmbedBuilder().setTitle("🏆 Leaderboard Akhir").setDescription(leaderboard).setColor("Gold") ] });
    activeGames.delete(channel.id);
    console.log("🟢 GAME END");
  }};
module.exports = {
  startGame,
  activeGames,
  disableLobbyComponents,
};
