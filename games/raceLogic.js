const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");

// ===== CONFIG =====
const JOIN_TIMEOUT_MS = 20000;
const MAX_PLAYERS = 25;

const { TRACK_LENGTH, MODE_CONFIG, RACERS_EMOJIS, FINISH_FLAG, TRACK_CHAR } = require("../utils/race/raceConfig");
const { sleep, shuffle } = require("../utils/race/raceHelpers");
const { calculateMove } = require("../utils/race/raceEngine");
// const { buildTrack } = require("../utils/race/raceHelpers");

// function track(r){
//   const emoji = r.effect ? `${r.effect}${r.baseEmoji}` : r.baseEmoji;
//   return buildTrack(r.position, emoji);
// }
function track(r){
  const pos = Math.min(Math.max(0, Math.floor(r.position)), TRACK_LENGTH);
  return `\`${TRACK_CHAR.repeat(pos)}${r.emoji}${TRACK_CHAR.repeat(TRACK_LENGTH-pos)}\`${FINISH_FLAG}`;
}

const activeRaces = new Map();


// ===== EMBED =====
function lobbyEmbed(race, host, timeLeft){
  const racers = race.racers.map((r,i)=>`**#${i+1}** ${r.emoji} <@${r.userId}>`).join("\n") || "Belum ada yang join :(";

  return new EmbedBuilder()
    .setTitle("🏁 RACE LOBBY")
    .setDescription(
      `Host: <@${host}>\n` +
      `Mode: **${race.mode.toUpperCase()}**\n` +
      `⏳ Waktu join tersisa: **${timeLeft}s**\n\n` +
      `**Racers (${race.racers.length}/${MAX_PLAYERS}):**\n${racers}`
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

    const eventIcon = (!r.finished && r.event) ? ` ${r.event}` : "";

    return `**#${i+1}** ${r.emoji} <@${r.userId}> — ${status} ${eventIcon}\n${track(r)}`;
  });

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(lines.join("\n\n"))
    .setColor(0xf5a623);
}

// ===== BUTTON =====
function mainRow(race){
  const icons = { normal:"⚪", fast:"⚡", chaos:"🔥" };

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("mode_cycle").setLabel(`${icons[race.mode]} ${race.mode.toUpperCase()}`).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("toggle_join").setLabel("🎯 Join / Leave").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("start").setLabel("🏁 Start").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("mode_info").setLabel("ℹ️ Info").setStyle(ButtonStyle.Secondary)
  );
}

function disabledRows(){
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("mode").setLabel("Mode").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("join").setLabel("Join").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("start").setLabel("Start").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("mode_info").setLabel("ℹ️ Info").setStyle(ButtonStyle.Secondary).setDisabled(true)
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
    components:[mainRow(race)]
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
      components:[mainRow(race)]
    }).catch(()=>{});
  },1000);

  const col = msg.createMessageComponentCollector({componentType:ComponentType.Button,time:JOIN_TIMEOUT_MS});

  col.on("collect", async i=>{
    if(race.started) return i.deferUpdate();

    // MODE
    if(i.customId==="mode_cycle"){
      if(i.user.id!==hostId)
        return i.reply({content:"Host only!",ephemeral:true});

      const modes = ["normal","fast","chaos"];
      const index = modes.indexOf(race.mode);
      race.mode = modes[(index+1)%modes.length];

      return i.update({embeds:[lobbyEmbed(race,hostId,timeLeft)],components:[mainRow(race)]});
    }

    // JOIN / LEAVE
    if(i.customId==="toggle_join"){
      const existing = race.racers.find(r=>r.userId===i.user.id);

      if(!existing && race.racers.length >= MAX_PLAYERS){
        return i.reply({content:"Slot penuh!",ephemeral:true});
      }

      if(existing){
        race.racers = race.racers.filter(r=>r.userId!==i.user.id);
      } else {
        race.racers.push({
          userId:i.user.id,
          emoji: race.available.shift()||"🐢",
          position:0,
          finished:false,
          lastMove:0,
          stunned:0,
          event:null
        });
      }

      // AUTO START
      if(race.racers.length >= MAX_PLAYERS){
        race.started = true;

        clearInterval(interval);
        col.stop("full");

        await i.update({
          embeds:[lobbyEmbed(race,hostId,0)],
          components:disabledRows()
        });

        msg.channel.send("🔥 Slot penuh! Race otomatis dimulai!");
        return runRace(race,msg);
      }

      return i.update({embeds:[lobbyEmbed(race,hostId,timeLeft)],components:[mainRow(race)]});
    }

    // START
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

    // INFO
    if(i.customId === "mode_info"){
  return i.reply({
    ephemeral: true,
    content:
    `**RACE GAME INFO**
**🎮 Mode:**
    ⚪ Normal → stabil & seimbang  
    ⚡ Fast → lebih cepat & agresif  
    🔥 Chaos → penuh event random & chaos
**🎊 Event:**
    🚀 Turbo → maju cepat  
    🍌 Slip → melambat  
    ⚡ Stun → tidak bergerak  
    💥 Mundur → posisi turun  
    🧲 Magnet → tarik ke depan  
    💣 Bomb → stun sekitar  
    🔥 Boost → comeback  
          `});
        }
  });
    // 👑 Leader → target utama

  col.on("end",(_,r)=>{
    clearInterval(interval);

    if(r==="full") return;

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

  const raceMsg = await channel.send({
    embeds:[raceEmbed(race,"🏎️ Race Started!")]
  });

  const finish = [];

  while(finish.length < race.racers.length){
    await sleep(config.tick);

    // 🌪️ GLOBAL CHAOS
    if(race.mode==="chaos" && Math.random()<0.08){
      race.racers.forEach(r=>{
        if(!r.finished){
          r.position += Math.random()<0.5 ? -1 : 1;
          r.position = Math.max(0, r.position);
          r.event = Math.random()<0.5 ? "🌪️" : "✨";
        }
      });
    }

    const leader = [...race.racers].sort((a,b)=>b.position-a.position)[0];

    for(const r of shuffle(race.racers)){
      if(r.finished) continue;

      if(r.stunned>0){
        r.stunned--;
        r.event="⚡";
        continue;
      }

      // ===== ENGINE =====
      const { move, event } = calculateMove(r, config, race.mode);
      r.event = event;

      // ===== CHAOS EXTRA (1 BLOCK SAJA) =====
      if(race.mode==="chaos" && Math.random()<0.15){
        if(Math.random()<0.5 && leader && leader.userId!==r.userId){
          r.position = Math.min(r.position+2, leader.position);
          r.event="🧲";
        } else {
          race.racers.forEach(t=>{
            if(t!==r && Math.abs(t.position-r.position)<=3){
              t.stunned=1; t.event="💣";
            }
          });
          r.event="💣";
        }
      }

      // ===== APPLY MOVE =====
      r.position += Math.min(move, TRACK_LENGTH - r.position);

      if(r.position>=TRACK_LENGTH){
        r.finished=true;
        finish.push(r);
      }
    }

    // 👑 LEADER
    // if(leader && !leader.finished){
    //   leader.event = leader.event ? `👑${leader.event}` : "👑";
    //   if(race.mode==="chaos" && Math.random()<0.3){
    //     leader.stunned = Math.max(leader.stunned,1);
    //   }
    // }

    await raceMsg.edit({
      embeds:[raceEmbed(
        race,
        finish.length===race.racers.length ? "🏆 FINISHED!" : "🏎️ RACING...",
        finish
      )]
    });
  }

  // RESULT
  const medals=["🥇","🥈","🥉"];
  const resultText = finish.map((r,i)=>
    `${medals[i]||`${i+1}.`} <@${r.userId}> ${r.emoji}`
  ).join("\n");

  await channel.send({
    embeds:[
      new EmbedBuilder()
        .setTitle("🏆 RACE RESULTS")
        .setDescription(`Mode: **${race.mode.toUpperCase()}**\n\n${resultText}`)
        .setColor(0xffd700)
    ]
  });

  activeRaces.delete(race.channelId);
}

module.exports = { startRace, activeRaces };