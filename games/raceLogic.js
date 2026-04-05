const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");

// ===== CONFIG =====
const TRACK_LENGTH = 48;
const JOIN_TIMEOUT_MS = 25000;
const MAX_PLAYERS = 25;

const MODE_CONFIG = {
  normal: { tick: 1500, baseMove: [3,5], boostChance: 0.1, lagChance: 0.05 },
  fast:   { tick: 900,  baseMove: [4,7], boostChance: 0.15, lagChance: 0.03 },
  chaos:  { tick: 1200, baseMove: [2,6], boostChance: 0.2, lagChance: 0.1 },
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
    new ButtonBuilder()
      .setCustomId("mode_cycle")
      .setLabel(`${icons[race.mode]} ${race.mode.toUpperCase()}`)
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("toggle_join")
      .setLabel("🎯 Join / Leave")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("start")
      .setLabel("🏁 Start")
      .setStyle(ButtonStyle.Danger),
      
    new ButtonBuilder()
      .setCustomId("mode_info")
      .setLabel("ℹ️ Info")
      .setStyle(ButtonStyle.Secondary)
  );
}

function disabledRows(){
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("mode").setLabel("Mode").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("join").setLabel("Join").setStyle(ButtonStyle.Secondary).setDisabled(true),
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
🎮 Mode:
    ⚪ Normal → stabil & seimbang  
    ⚡ Fast → lebih cepat & agresif  
    🔥 Chaos → penuh event random & chaos
⚡ Event:
    🚀 Turbo → maju cepat  
    🍌 Slip → melambat  
    ⚡ Stun → tidak bergerak  
    💥 Mundur → posisi turun  
    🧲 Magnet → tarik ke depan  
    💣 Bomb → stun sekitar  
    🔥 Boost → comeback  
    👑 Leader → target utama`
          });
        }
  });

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

  const raceMsg = await channel.send({embeds:[raceEmbed(race,"🏎️ Race Started!")]});
  const finish = [];

  while(finish.length<race.racers.length){
    await sleep(config.tick);

    // GLOBAL CHAOS
    if(race.mode==="chaos" && Math.random()<0.08){
      race.racers.forEach(r=>{
        if(r.finished) return;
        if(Math.random()<0.5){
          r.position = Math.max(0, r.position-1);
          r.event="🌪️";
        } else {
          r.position+=1;
          r.event="✨";
        }
      });
    }

    for(const r of shuffle(race.racers)){
      if(r.finished) continue;

      r.event=null;

      if(r.stunned>0){
        r.stunned--;
        r.event="⚡";
        continue;
      }

      const progress = r.position/TRACK_LENGTH;

      let move = config.baseMove[0] + Math.random()*(config.baseMove[1]-config.baseMove[0]);

      const eventChance = race.mode==="chaos"?0.55:0.08;

      if(Math.random()<eventChance){
        const rand = Math.random();

        if(rand < 0.2){move += 4;r.event = "🚀";} 
        else if(rand < 0.35){move -= 3;r.event = "🍌";} 
        else if(rand < 0.5){r.stunned = 2;r.event = "⚡";move = 0;} 
        else if(rand < 0.65){r.position = Math.max(0, r.position - 3);r.event = "💥";move = 0;        } 
        else if(rand < 0.78){const leader = [...race.racers].sort((a,b)=>b.position-a.position)[0];
          if(leader && leader.userId !== r.userId){
            r.position = Math.min(r.position + 2, leader.position);r.event = "🧲";}
        }
        else if(rand < 0.9){race.racers.forEach(target=>{
            if(target.userId !== r.userId && Math.abs(target.position - r.position) <= 3){
              target.stunned = 1;target.event = "💣";}
          });
          r.event = "💣";move = 0;
        }
        else {if(progress < 0.5){move += 5;r.event = "🔥";}}
      }

      if(race.mode==="chaos"){
        if(progress>0.7 && Math.random()<0.25){ move-=2; r.event="😵"; }
        if(progress<0.4 && Math.random()<0.3){ move+=2; r.event="🔥"; }
      }

      if(Math.random()<config.boostChance*(1-progress)) move+=2;
      if(Math.random()<config.lagChance*(1-progress/2)) move-=1;

      let finalMove = Math.max(1, Math.round(move));

      if(r.position + finalMove > TRACK_LENGTH){
        finalMove = TRACK_LENGTH - r.position;
      }

      r.position += finalMove;

      if(r.position>=TRACK_LENGTH){
        r.position=TRACK_LENGTH;
        r.finished=true;
        finish.push(r);
      }
    }
// 👑 leader mark
const leader = [...race.racers].sort((a,b)=>b.position-a.position)[0];

if(leader && !leader.finished){
  leader.event = "👑";

  // chaos = leader jadi target
  if(race.mode === "chaos" && Math.random() < 0.3){
    leader.stunned = Math.max(leader.stunned,1);
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
        .setDescription(`Mode: **${race.mode.toUpperCase()}**\n\n${resultText}`)
        .setColor(0xffd700)
    ]
  });

  activeRaces.delete(race.channelId);
}

module.exports = { startRace, activeRaces };