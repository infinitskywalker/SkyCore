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
  normal: "Normal speed & balanced ⚪",
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
  const pos = Math.min(Math.max(0, Math.floor(r.position)), TRACK_LENGTH);
  return `\`${TRACK_CHAR.repeat(pos)}${r.emoji}${TRACK_CHAR.repeat(TRACK_LENGTH-pos)}\`${FINISH_FLAG}`;
}

// ===== EMBED =====
function lobbyEmbed(race, host, timeLeft){
  const racers = race.racers.map((r,i)=>`**#${i+1}** ${r.emoji} <@${r.userId}>`).join("\n") || "Belum ada yang join :(";

  return new EmbedBuilder()
    .setTitle("🏁 Race Lobby")
    .setDescription(
      `Host: <@${host}>\n` +
      `Mode: **${race.mode.toUpperCase()}**\n` +
      `⏳ Waktu join tersisa: **${timeLeft}s**\n\n` +
      `**Racers:**\n${racers}`
    )
    .setColor(0x5865f2);
}

function raceEmbed(race,title,finish=[]){
  const medals = ["🥇","🥈","🥉"];

  const lines = race.racers.map((r,i)=>{
    const finishIndex = finish.findIndex(f=>f.userId===r.userId);

    let status;
    if(r.finished){
      status = medals[finishIndex] || `#${finishIndex+1}`;
    } else {
      status = `${Math.round((r.position/TRACK_LENGTH)*100)}%`;
    }

    // const moveText = r.lastMove ? (r.lastMove > 0 ? `(+${r.lastMove})` : `(${r.lastMove})`) : "";

    const eventIcon = r.event ? ` ${r.event}` : "";

    return `**#${i+1}** ${r.emoji} <@${r.userId}> — ${status} ${eventIcon}\n${track(r)}`;
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
    if(timeLeft<=0) return;

    msg.edit({
      embeds:[lobbyEmbed(race,hostId,timeLeft)],
      components:[modeRow(race.mode),actionRow()]
    }).catch(()=>{});
  },1000);

  const col = msg.createMessageComponentCollector({componentType:ComponentType.Button,time:JOIN_TIMEOUT_MS});

  col.on("collect", async i=>{
    if(race.started) return i.deferUpdate();

    if(i.customId.startsWith("mode_")){
      if(i.user.id !== hostId)
        return i.reply({ content: "Host only!", ephemeral: true });

      if(i.customId === "mode_info"){
        return i.reply({
          content:
            `⚪ ${MODE_INFO.normal}\n⚡ ${MODE_INFO.fast}\n🔥 ${MODE_INFO.chaos}`,
          ephemeral: true
        });
      }

      race.mode = i.customId.split("_")[1];
      return i.update({embeds:[lobbyEmbed(race,hostId,timeLeft)],components:[modeRow(race.mode), actionRow()]});
    }

    if(i.customId==="join"){
      if(race.racers.find(r=>r.userId===i.user.id))
        return i.reply({content:"Sudah join!",ephemeral:true});

      race.racers.push({
        userId:i.user.id,
        emoji: race.available.shift()||"🐢",
        position:0,
        finished:false,
        lastMove:0,
        stunned:0,
        event:null
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

      clearInterval(interval);
      race.started = true;

      col.stop("start");
      await i.deferUpdate();

      msg.edit({components:disabledRows()});
      msg.channel.send("🏁 Race dimulai!");

      runRace(race,msg);
    }
  });

  col.on("end",(_,r)=>{
    clearInterval(interval);

    if(r!=="start" && race.racers.length>=2){
      if(race.started) return;
      race.started = true;

      msg.edit({components:disabledRows()});
      msg.channel.send("🏁 Race dimulai!");
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
  const channel = msg.channel;
  const config = MODE_CONFIG[race.mode];

  const raceMsg = await channel.send({embeds:[raceEmbed(race,"🏎️ Race Started!")]});
  const finish = [];

  while(finish.length<race.racers.length){
    await sleep(config.tick);

    const tickRacers = shuffle(race.racers);

    for(const r of tickRacers){
      if(r.finished) continue;

      r.event = null;

      if(r.stunned > 0){
        r.stunned--;
        r.lastMove = 0;
        r.event = "⚡";
        continue;
      }

      const progress = r.position / TRACK_LENGTH;

      let move = config.baseMove[0] + Math.random()*(config.baseMove[1]-config.baseMove[0]);

      // if(progress > 0.8) move *= 0.5;

      const eventChance = race.mode === "chaos" ? 0.40 : 0.08;
      if(Math.random() < eventChance){
      // if(Math.random() < 0.08){
        const rand = Math.random();
        if(rand < 0.33){
          move += 3;
          r.event = "💨";
        } else if(rand < 0.66){
          move -= 2;
          r.event = "🍌";
        } else {
          r.stunned = 1;
          // r.stunned = race.mode === "chaos" ? 2 : 1; 
          r.event = "⚡";
        }
      }

      if(Math.random()<config.boostChance*(1-progress)) move+=2;
      if(Math.random()<config.lagChance*(1-progress/2)) move-=1;

      if(race.mode==="chaos" && Math.random()<0.1){
        move += (Math.random()<0.5 ? -2 : 3);
      }

      let finalMove = Math.max(1, Math.round(move));

      if(r.position + finalMove > TRACK_LENGTH){
        finalMove = TRACK_LENGTH - r.position;
      }

      r.position += finalMove;
      r.lastMove = finalMove;

      if(r.position>=TRACK_LENGTH){
        r.position=TRACK_LENGTH;
        r.finished=true;
        finish.push(r);
      }
    }

    // // 🔥 leader
    // const leader = [...race.racers].sort((a,b)=>b.position-a.position)[0];
    // if(leader && !leader.finished){
    //   leader.event = "👑";
    // }

    const title = finish.length===race.racers.length ? "🏆 Finished!" : "🏎️ Racing...";

    await raceMsg.edit({
      embeds:[raceEmbed(race,title,finish)]
    });
  }

  const medals=["🥇","🥈","🥉"];

  const resultText = finish.map((r,i)=>
    `${medals[i]||`${i+1}.`} <@${r.userId}> ${r.emoji}`
  ).join("\n");

  await channel.send({
    embeds:[
      new EmbedBuilder()
        .setTitle("🏆 Race Results")
        .setDescription(`Mode: **${race.mode.toUpperCase()}**\n\n${resultText}`)
        .setColor(0xffd700)
    ]
  });

  activeRaces.delete(race.channelId);
}

module.exports = { startRace, activeRaces };