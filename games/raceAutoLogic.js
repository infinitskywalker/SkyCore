const { EmbedBuilder } = require("discord.js");

// ===== CONFIG =====
const TRACK_LENGTH = 48;
const BET_DURATION = 15000;

const MODE_CONFIG = {
  normal: { tick: 1200, baseMove: [3,5], boostChance: 0.1, lagChance: 0.05 },
  fast:   { tick: 800,  baseMove: [4,7], boostChance: 0.15, lagChance: 0.03 },
  chaos:  { tick: 1000, baseMove: [2,6], boostChance: 0.2, lagChance: 0.1 },
};

const RACERS_EMOJIS = [
  "🐸","🦆","🐧","🦀","🐙","🐡","🐹","🦔","🦦","🦥",
  "🐼","🦘","🦙","🐨","🦁","🐯","🐻","🐷","🐵","🐔",
  "🐴","🦄","🐝","🐌","🐍","🦎","🐲","👾","🤖","🚗","🏎️","🚀"
];

const FINISH_FLAG = "🏁";
const TRACK_CHAR = "─";

// ===== GLOBAL BET STORAGE =====
const activeBets = new Map(); // raceId -> { bets, open, totalRacers }

// ===== HELPER =====
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

function track(r){
  const pos = Math.min(Math.floor(r.position), TRACK_LENGTH);
  return `\`${TRACK_CHAR.repeat(pos)}${r.emoji}${TRACK_CHAR.repeat(TRACK_LENGTH-pos)}\`${FINISH_FLAG}`;
}

// ===== EMBED =====
function raceEmbed(race, title, finish=[]){
    const maxPos = Math.max(...race.racers.map(r => r.position));
  const lines = race.racers.map((r,i)=>{
    let status = r.finished
      ? `#${finish.findIndex(f=>f.id===r.id)+1}`
      : `${Math.round((r.position/TRACK_LENGTH)*100)}%`;
     
    let emojiDisplay = r.emoji;
    if(r.position === maxPos && !r.finished) emojiDisplay = `🏎️ ${r.emoji}`; // highlight leader
    return `**#${i+1}** ${emojiDisplay} — ${status}\n${track(r)}`;

    // return `**#${i+1}** ${r.emoji} — ${status}\n${track(r)}`;
  });

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(lines.join("\n\n"))
    .setColor(0xf5a623);
}

// ===== MAIN =====
async function startAutoRace(channel, count=2, mode="normal"){
  if(count < 2 || count > 10){
    return channel.send("Jumlah racer 2 - 10");
  }

  if(!MODE_CONFIG[mode]) mode = "normal";

  const raceId = Date.now();
  const emojis = shuffle(RACERS_EMOJIS).slice(0, count);

  const race = {
    id: raceId,
    mode,
    racers: emojis.map((e,i)=>({
      id: i,
      emoji: e,
      position: 0,
      finished: false
    }))
  };

  const config = MODE_CONFIG[mode];

  // ===== INIT BET =====
  activeBets.set(raceId, {
    bets: new Map(),
    open: true,
    totalRacers: count
  });

  // ===== START EMBED =====
  const startEmbed = new EmbedBuilder()
    .setTitle("🎲 AUTO RACE START")
    .setDescription(
      `Mode: **${mode.toUpperCase()}**\n` +
      `Total Racer: **${count}**\n\n` +
      race.racers.map((r,i)=>`**${i+1}.** ${r.emoji}`).join("\n") +
      `\n\n💰 Tebak: \`!bet <nomor>\``
    )
    .setColor(0x5865f2);

  await channel.send({ embeds: [startEmbed] });
  
  // ===== COUNTDOWN + LIST BETTERS =====
  let countdown = BET_DURATION / 1000; // detik
  const countdownMsg = await channel.send({ embeds: [new EmbedBuilder()
    .setTitle("⏳ Waktu Tebak")
    .setDescription(`Waktu tersisa: **${countdown}s**\nBelum ada yang menebak!`)
    .setColor(0xf5a623)
  ]});

  const countdownInterval = setInterval(async () => {
    countdown--;

    const betData = activeBets.get(raceId);
    let bettorsList = "";
    if(betData && betData.bets.size > 0){
      bettorsList = [...betData.bets.entries()]
        .map(([userId, choice]) => `<@${userId}> → #${choice}`)
        .join("\n");
    }

    // update embed
    await countdownMsg.edit({ embeds: [new EmbedBuilder()
      .setTitle("⏳ Waktu Tebak")
      .setDescription(
        `Waktu tersisa: **${countdown}s**\n` +
        (bettorsList || "Belum ada yang menebak!")
      )
      .setColor(0xf5a623)
    ]});

  }, 1000);

  // ===== CLOSE BET =====
  await sleep(BET_DURATION);
  clearInterval(countdownInterval);

  const betDataFinal = activeBets.get(raceId);

  if(!betDataFinal || betDataFinal.bets.size === 0){
    activeBets.delete(raceId);
    return channel.send("❌ Race dibatalkan karena tidak ada yang menebak!");
  }

  if(betDataFinal) betDataFinal.open = false;
  await channel.send("⛔ Waktu tebak habis!");

  // ===== START RACE =====
  const raceMsg = await channel.send({
    embeds: [raceEmbed(race, "🏎️ Racing...")]
  });

  const finish = [];

  while(finish.length < race.racers.length){
    await sleep(config.tick);

    for(const r of race.racers){
      if(r.finished) continue;

      let move = config.baseMove[0] + Math.random() * (config.baseMove[1] - config.baseMove[0]);

      //  if(Math.random() < config.boostChance) {
      //   move += 2;
      //   r.emoji = `⚡${r.emoji}`;
      //   }
      //   if(Math.random() < config.lagChance) {
      //       move -= 2;
      //       r.emoji = `🐌${r.emoji}`;
      //   }
      if(Math.random() < config.boostChance) move += 2;
      if(Math.random() < config.lagChance) move -= 2;

      if(mode === "chaos" && Math.random() < 0.15){
        r.position += (Math.random() < 0.5 ? -4 : 6);
      }
if(mode.startsWith("chaos")){
  const eventRoll = Math.random();
  if(eventRoll < 0.05){ // 5% chance
    r.position += 3; // lucky boost
    r.emoji = `🍀${r.emoji}`;
  } else if(eventRoll < 0.10){ // next 5%
    r.position -= 2; // obstacle
    r.emoji = `🪨${r.emoji}`;
  }
}
      r.position += Math.max(0, move);

      if(r.position >= TRACK_LENGTH){
        r.position = TRACK_LENGTH;
        r.finished = true;
        finish.push(r);
      }
    }

    const title = finish.length === race.racers.length ? "🏆 Finished!" : "🏎️ Racing...";
    await raceMsg.edit({ embeds: [raceEmbed(race, title, finish)] });
  }

  // ===== RESULT =====
  const medals = ["🥇","🥈","🥉"];
  const resultText = finish.map((r,i)=>
    `${medals[i] || `${i+1}.`} ${r.emoji}`
  ).join("\n");

  const winnerIndex = finish[0].id + 1;
  let winners = [];

  if(betDataFinal){
    for(const [userId, choice] of betDataFinal.bets){
      if(choice === winnerIndex){
        winners.push(`<@${userId}>`);
      }
    }
  }

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🏆 AUTO RACE RESULT")
        .setDescription(
          `Mode: **${mode.toUpperCase()}**\n\n` +
          `${resultText}\n\n` +
          `🎉 Pemenang: ${finish[0].emoji} (Racer #${winnerIndex})\n\n` +
          (winners.length
            ? `🎁 Pemenang Tebakan:\n${winners.join("\n")}`
            : "😢 Tidak ada yang benar!")
        )
        .setColor(0xffd700)
    ]
  });

  activeBets.delete(raceId);
}

// ===== EXPORT =====
module.exports = { startAutoRace, activeBets };