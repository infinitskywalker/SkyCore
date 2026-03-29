const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");

// ===== CONFIG =====
const TRACK_LENGTH = 48;
const JOIN_TIMEOUT_MS = 25000;

const MODE_CONFIG = {
  normal: { tick: 1500, baseMove: [3,5], boostChance: 0.1, lagChance: 0.05 },
  fast:   { tick: 900,  baseMove: [4,7], boostChance: 0.15, lagChance: 0.03 },
  chaos:  { tick: 1200, baseMove: [2,6], boostChance: 0.2, lagChance: 0.1 },
};

const MODE_INFO = {
  normal: "Balance antara kecepatan & RNG",
  fast: "Lebih cepat & agresif ⚡",
  chaos: "Banyak event random 🔥",
};

const RACERS_EMOJIS = ["🐸","🦆","🐧","🦀","🐙","🦑","🐡","🦞","🐹","🦔","🦦","🦥","🐼","🦘","🦙","🐨","🦁","🐯","🐻","🐷","🐵","🐔","🦉","🦇","🐴","🦄","🐝","🦋","🐌","🐍","🦎","🦂","🦟","🦗","🐞","🦠","🐲","👾","🤖","🚗","🏎️","🚀","🛸","🚁","🛶","⛵","🛴"];

const FINISH_FLAG = "🏁";
const TRACK_CHAR = "─";

const activeRaces = new Map();

// ===== HELPER =====
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const shuffle = arr => [...arr].sort(()=>Math.random()-0.5);

function track(r){
  const pos = Math.min(Math.floor(r.position), TRACK_LENGTH);
  return `\`${TRACK_CHAR.repeat(pos)}${r.emoji}${TRACK_CHAR.repeat(TRACK_LENGTH-pos)}\`${FINISH_FLAG}`;
}

// ===== EMBED =====
function lobbyEmbed(race, host, timeLeft){
  const racers = race.racers.map((r,i)=>`**#${i+1}** ${r.emoji} <@${r.userId}>`).join("\n") || "Belum ada yang join :(";

  return new EmbedBuilder()
    .setTitle("🏁 Race Lobby")
    .setDescription(
      `Host: <@${host}> (tidak ikut balapan)\n` +
      `Mode: **${race.mode.toUpperCase()}**\n(${MODE_INFO[race.mode]})\n\n` +
      `⏳ Waktu join tersisa: **${timeLeft}s**\n\n` +
      `**Racers:**\n${racers}`
    )
    .setColor(0x5865f2);
}

function raceEmbed(race,title,finish=[]){
  const lines = race.racers.map((r,i)=>{
    let status = r.finished
      ? `#${finish.findIndex(f=>f.userId===r.userId)+1}`
      : `${Math.round((r.position/TRACK_LENGTH)*100)}%`;

    return `**#${i+1}** ${r.emoji} <@${r.userId}> — ${status}\n${track(r)}`;
  });

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(lines.join("\n\n"))
    .setColor(0xf5a623);
}

// ===== BUTTONS =====
function modeRow(mode){
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("mode_normal").setLabel(mode==="normal"?"⚪ Normal ✅":"⚪ Normal").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("mode_fast").setLabel(mode==="fast"?"⚡ Fast ✅":"⚡ Fast").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("mode_chaos").setLabel(mode==="chaos"?"🔥 Chaos ✅":"🔥 Chaos").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("mode_info").setLabel("ℹ️ Mode Info").setStyle(ButtonStyle.Secondary)
  );
}

function actionRow(){
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("join").setLabel("Join 🏎️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("leave").setLabel("Leave 🚫").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("start").setLabel("Start 🏁").setStyle(ButtonStyle.Success)
  );
}

function disabledRows(){
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("mode_normal").setLabel("⚪ Normal").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("mode_fast").setLabel("⚡ Fast").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("mode_chaos").setLabel("🔥 Chaos").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("mode_info").setLabel("ℹ️ Mode Info").setStyle(ButtonStyle.Secondary).setDisabled(true)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("join").setLabel("Join").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("leave").setLabel("Leave").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("start").setLabel("Start").setStyle(ButtonStyle.Secondary).setDisabled(true)
    )
  ];
}

// ===== START =====
async function startRace(channel, hostUser){
  if(activeRaces.has(channel.id)) return channel.send("Race already running!");

  const race = {
    channelId: channel.id,
    mode: "normal",
    racers:[],
    available: shuffle(RACERS_EMOJIS),
    started:false
  };

  activeRaces.set(channel.id,race);

  const msg = await channel.send({
    embeds:[lobbyEmbed(race,hostUser.id, Math.floor(JOIN_TIMEOUT_MS/1000))],
    components:[modeRow(race.mode), actionRow()]
  });

  lobbyHandler(race,msg,hostUser.id);
}

// ===== LOBBY =====
function lobbyHandler(race,msg,hostId){
  let timeLeft = Math.floor(JOIN_TIMEOUT_MS / 1000);

  const interval = setInterval(()=>{
    timeLeft--;
    if(timeLeft<=0) return clearInterval(interval);

    msg.edit({
      embeds:[lobbyEmbed(race,hostId,timeLeft)],
      components:[modeRow(race.mode),actionRow()]
    }).catch(()=>{});
  },1000);

  const col = msg.createMessageComponentCollector({componentType:ComponentType.Button,time:JOIN_TIMEOUT_MS});

  col.on("collect", async i=>{
    if(race.started){
      await i.deferUpdate().catch(()=>{});
      return msg.channel.send("⚠️ Race sudah dimulai!");
    }

    if(i.customId==="join"){
  
      if(race.racers.find(r=>r.userId===i.user.id))
        return i.reply({content:"Sudah join!",ephemeral:true});

      race.racers.push({
        userId:i.user.id,
        emoji: race.available.shift()||"🐢",
        position:0,
        finished:false
      });

      return i.update({embeds:[lobbyEmbed(race,hostId,timeLeft)],components:[modeRow(race.mode),actionRow()]});
    }

    if(i.customId==="leave"){
      race.racers = race.racers.filter(r=>r.userId!==i.user.id);
      return i.update({embeds:[lobbyEmbed(race,hostId,timeLeft)],components:[modeRow(race.mode),actionRow()]});
    }

    if(i.customId==="start"){
      if(i.user.id!==hostId) return i.reply({content:"Host only!",ephemeral:true});
      if(race.racers.length<2) return i.reply({content:"Minimal 2 pemain!",ephemeral:true});

      col.stop("start");
      await i.deferUpdate();

      msg.edit({components:disabledRows()});
      msg.channel.send("🏁 Race dimulai!");

      runRace(race,msg);
    }
  });

  col.on("end",(_,r)=>{
    if(r!=="start" && race.racers.length>=2){
      msg.edit({components:disabledRows()});
      msg.channel.send("🏁 Race dimulai otomatis!");
      runRace(race,msg);
    } else if(race.racers.length<2){
      activeRaces.delete(race.channelId);
      msg.edit({components:disabledRows()});
      msg.channel.send("❌ Race dibatalkan (tidak cukup pemain)");
    }
  });
}

// ===== RACE =====
async function runRace(race,msg){
  race.started = true;
  const channel = msg.channel;
  const config = MODE_CONFIG[race.mode];

  const raceMsg = await channel.send({embeds:[raceEmbed(race,"🏎️ Race Started!")]});
  const finish = [];

  while(finish.length<race.racers.length){
    await sleep(config.tick);

    const tickRacers = shuffle(race.racers);

    for(const r of tickRacers){
      if(r.finished) continue;

      const progress = r.position / TRACK_LENGTH;

      let move = config.baseMove[0] + Math.random()*(config.baseMove[1]-config.baseMove[0]);

      // lebih fair di akhir
      if(progress > 0.8){
        move *= 0.5;
      }

      // boost makin kecil kalau udah depan
      if(Math.random()<config.boostChance*(1-progress)) move+=2;

      // lag kecil aja biar ga brutal
      if(Math.random()<config.lagChance*(1-progress/2)) move-=1;

      if(race.mode==="chaos" && Math.random()<0.1){
        r.position += (Math.random()<0.5 ? -2 : 3);
      }

      // hard cap biar ga teleport finish
      if(r.position + move > TRACK_LENGTH){
        move = TRACK_LENGTH - r.position;
      }

      r.position += Math.max(0,move);

      if(r.position>=TRACK_LENGTH){
        r.position=TRACK_LENGTH;
        r.finished=true;
        finish.push(r);
      }
    }

    const title = finish.length===race.racers.length ? "🏆 Finished!" : "🏎️ Racing...";
    await raceMsg.edit({embeds:[raceEmbed(race,title,finish)]});
  }

  const medals=["🥇","🥈","🥉"];

  const resultText = finish.map((r,i)=>
    `${medals[i]||`${i+1}.`} <@${r.userId}> ${r.emoji}`
  ).join("\n");

  await channel.send({
    embeds:[
      new EmbedBuilder()
        .setTitle("🏆 Race Results")
        .setDescription(
          `Mode: **${race.mode.toUpperCase()}**\n\n` +
          `🔥 Hasil akhir balapan:\n\n${resultText}`
        )
        .setColor(0xffd700)
    ]
  });

  activeRaces.delete(race.channelId);
}

module.exports = { startRace, activeRaces };