const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { sleep, shuffle, buildTrack } = require("../utils/race/raceHelpers");
const { calculateMove } = require("../utils/race/raceEngine");
const { TRACK_LENGTH, MODE_CONFIG, RACERS_EMOJIS } = require("../utils/race/raceConfig");

const MODE_ICONS = { normal:"⚪", fast:"⚡", chaos:"🔥" };
const RACER_OPTIONS = [2,5,10];
const BET_DURATION = 15000;

const activeBets = new Map(); // raceId -> state

function track(r){
  const emoji = r.effect ? `${r.effect}${r.baseEmoji}` : r.baseEmoji;
  return buildTrack(r.position, emoji);
}

function raceEmbed(race, title, finish=[]){
  const lines = race.racers.map((r,i)=>{
    let status = r.finished 
      ? `#${finish.findIndex(f=>f.id===r.id)+1}` 
      : `${Math.round((r.position/TRACK_LENGTH)*100)}%`;

    return `**#${i+1}** ${r.baseEmoji} — ${status}\n${track(r)}`;
  });

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(lines.join("\n\n"))
    .setColor(0xf5a623);
}

// ✅ BET BUTTON (dynamic)
function getBetRow(selectedAmount){
  const amounts = [10000, 25000, 50000, 100000];

  return new ActionRowBuilder().addComponents(
    amounts.map(a => 
      new ButtonBuilder()
        .setCustomId(`bet_${a}`)
        .setLabel(`${a/1000}K ${selectedAmount === a ? "✅" : ""}`)
        .setStyle(selectedAmount === a ? ButtonStyle.Success : ButtonStyle.Secondary)
    )
  );
}

// ===== START AUTO RACE =====
async function startAutoRace(channel, hostId) {
  const raceId = Date.now();

  const state = {
    bets: new Map(),
    open: true,
    totalRacers: 2,
    mode: "normal",
    // players: [],
  approvedPlayers: [], // ✅ NEW
    hostId,
    raceId,
    channelId: channel.id,
    betAmount: 10000, // ✅ penting
    lobbyMessage: null,
  };
state.lobbyMessage = null;
  activeBets.set(raceId, state);
const embed = buildLobbyEmbed(state);

  // ===== BUTTONS =====
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cycle_mode').setLabel(`${MODE_ICONS[state.mode]} ${state.mode.toUpperCase()}`).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('cycle_racers').setLabel(`${state.totalRacers} RACERS`).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('start_race').setLabel('🏁 START').setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({
    embeds:[embed],
    components:[getBetRow(state.betAmount),row1]
  });
state.lobbyMessage = msg; // ✅ TAMBAHIN INI

  // ===== COLLECTOR =====
  let closed_lobby_time = 300000; // 5 menit 
  const collector = msg.createMessageComponentCollector({ time:closed_lobby_time });

  collector.on('collect', async i => {
    if(!activeBets.has(raceId)) return;
    const s = activeBets.get(raceId);

    await i.deferUpdate();

    switch(i.customId){

      case 'cycle_mode':
        if(i.user.id !== s.hostId) 
          return i.followUp({ content:"❌ Hanya host bisa ubah mode", ephemeral:true });

        const modes = Object.keys(MODE_ICONS);
        let idx = modes.indexOf(s.mode);
        s.mode = modes[(idx+1)%modes.length];
      break;

      case 'cycle_racers':
        if(i.user.id !== s.hostId) 
          return i.followUp({ content:"❌ Hanya host bisa ubah total racer", ephemeral:true });

        let idxR = RACER_OPTIONS.indexOf(s.totalRacers);
        s.totalRacers = RACER_OPTIONS[(idxR+1)%RACER_OPTIONS.length];
      break;

      case 'start_race':
        if(i.user.id !== s.hostId) 
          return i.followUp({ content:"❌ Hanya host bisa start race", ephemeral:true });

        if(!s.betAmount)
          return i.followUp({ content:"❌ Pilih bet dulu!", ephemeral:true });

        if(s.approvedPlayers.length < 1)
          return i.followUp({ content:"❌ Minimal ada 1 player!", ephemeral:true });

        collector.stop();
        startRaceCore(i.channel, s);
        return;

      default:
        // ✅ HANDLE BET
        if(i.customId.startsWith("bet_")){
          if(i.user.id !== s.hostId){
            return i.followUp({
              content:"❌ Hanya host yang bisa menentukan bet!",
              ephemeral:true
            });
          }

          const amount = parseInt(i.customId.split("_")[1]);
          s.betAmount = amount;

          await i.followUp({
            content:`💰 Bet diset ke **${amount/1000}K**`,
            ephemeral:false
          });
        }
      break;
    }

    // ===== UPDATE UI =====
    const updatedEmbed = new EmbedBuilder()
      .setTitle("🎲 RACE SETUP")
      .setDescription(
        `👤 Host: <@${s.hostId}>\n` +
        `🕹️ Mode: ${MODE_ICONS[s.mode]} **${s.mode.toUpperCase()}**\n` +
        `🏎️ Total Racers: **${s.totalRacers}**\n` +
        `💰 Bet: ${s.betAmount ? `**${s.betAmount/1000}K** 💸` : "Belum dipilih"}\n\n` +
        `🟢 Approved Players:\n${s.approvedPlayers.map(id=>`<@${id}>`).join("\n") || "Belum ada pemain"}`
      )
      .setColor(0x5865f2);

    row1.components[0].setLabel(`${MODE_ICONS[s.mode]} ${s.mode.toUpperCase()}`);
    row1.components[1].setLabel(`${s.totalRacers} RACERS`);

    await i.editReply({
      embeds:[updatedEmbed],
      components:[getBetRow(s.betAmount),row1]
    });
  });

  collector.on('end', () => {
    if(!msg.deleted) msg.edit({ components:[] }).catch(()=>{});
  });
}

function buildLobbyEmbed(state){
  return new EmbedBuilder()
    .setTitle("🎲 RACE SETUP")
    .setDescription(
      `👤 Host: <@${state.hostId}>\n` +
      `🕹️ Mode: ${MODE_ICONS[state.mode]} **${state.mode.toUpperCase()}**\n` +
      `🏎️ Total Racers: **${state.totalRacers}**\n` +
      `💰 Bet: ${state.betAmount ? `**${state.betAmount/1000}K** 💸` : "Belum dipilih"}\n\n` +
      `🟢 Approved Players:\n${
        state.approvedPlayers.map(id=>`<@${id}>`).join("\n") || "Belum ada pemain"
      }`
    )
    .setColor(0x5865f2);
}
// ===== CORE RACE =====
async function startRaceCore(channel, state){
  const { totalRacers: count, mode, hostId, betAmount } = state;

  const emojis = shuffle(RACERS_EMOJIS).slice(0, count);
  const race = {
    id: Date.now(),
    mode,
    betAmount, // ✅ dari state
    racers: emojis.map((e,i)=>({
      id:i,
      baseEmoji:e,
      effect:null,
      position:0,
      finished:false
    }))
  };

state.racerMap = Object.fromEntries(
  race.racers.map((r,i)=>[i+1, r.baseEmoji])
);
  // state.bets = new Map();
  state.open = true;

  const startEmbed = new EmbedBuilder()
    .setTitle("🎲 RACE BETTING START")
    .setDescription(
      `👤 Host: <@${hostId}>\n` +
      `Mode: **${mode.toUpperCase()}**\n` +
      `💰 Bet: **${betAmount/1000}K**\n\n` +
      race.racers.map((r,i)=>`🏁 **Racer #${i+1}** → ${r.baseEmoji}`).join("\n") +
      `\n\n💰 Tebak: \`!bet <nomor>\``
    )
    .setColor(0x5865f2);

  await channel.send({ embeds:[startEmbed] });

  // ===== COUNTDOWN =====
  let countdown = BET_DURATION/1000;

  const countdownMsg = await channel.send({
    embeds:[new EmbedBuilder()
      .setTitle("⏳ Waktu Tebak")
      .setDescription(`Waktu tersisa: **${countdown}s**\nBelum ada yang menebak!`)
      .setColor(0xf5a623)
    ]
  });

  const interval = setInterval(async ()=>{
    // countdown--;

    let bettorsList = "";
    if(state.bets.size>0){
      bettorsList = [...state.bets.entries()]
        .map(([uid,c])=>`<@${uid}> → ${race.racers[c-1]?.baseEmoji} (#${c})`)
        .join("\n");
    }
  await countdownMsg.edit({
    embeds:[new EmbedBuilder()
      .setTitle("⏳ Waktu Tebak")
      .setDescription(
        `Waktu tersisa: **${countdown}s**\n${bettorsList || "Belum ada yang menebak!"}`
      )
      .setColor(0xf5a623)
    ]
  });
  countdown--;
  if(countdown < 0){
    clearInterval(interval);
  }
}, 1000);

  await sleep(BET_DURATION);
  clearInterval(interval);

  state.open = false;
  await channel.send("⛔ Race betting telah dimulai!");

  const raceMsg = await channel.send({
    embeds:[raceEmbed(race, "🏎️ Racing...")]
  });

  const finish = [];
  const config = MODE_CONFIG[mode];

  while(finish.length < race.racers.length){
    await sleep(config.tick);

    for(const r of race.racers){
      if(r.finished) continue;

      r.effect = null;
      const res = calculateMove(r, config, mode);

      r.effect = res.event;
      r.position += res.move;
      r.position = Math.max(0, r.position);

      if(r.position >= TRACK_LENGTH){
        r.position = TRACK_LENGTH;
        r.finished = true;
        finish.push(r);
      }
    }

    await raceMsg.edit({
      embeds:[raceEmbed(
        race,
        finish.length===race.racers.length ? "🏆 Finished!" : "🏎️ Racing...",
        finish
      )]
    });
  }

  const medals = ["🥇","🥈","🥉"];
  const resultText = finish.map((r,i)=>`${medals[i]||`${i+1}.`} ${r.baseEmoji}`).join("\n");

  const winnerIndex = finish[0].id+1;
  // let winners = [];
  const totalBettors = state.bets.size;
const totalPool = totalBettors * betAmount;

let winners = [];
for(const [uid, choice] of state.bets){
  if(choice === winnerIndex){
    winners.push(uid);
  }
}

let rewardText = "";
const houseCut = 0.1; // 10%
const poolAfterCut = Math.floor(totalPool * (1 - houseCut));

if(winners.length > 0){
  const rewardPerUser = Math.floor(totalPool / winners.length);
  // const rewardPerUser = Math.floor(poolAfterCut / winners.length);

  rewardText = winners.map(uid => 
    `💰 <@${uid}> +${rewardPerUser}`
  ).join("\n");

} else {
  rewardText = "🏦 Bandar cair nih 😈";
}

  for(const [uid, choice] of state.bets){
    if(choice===winnerIndex) winners.push(`<@${uid}>`);
  }

  await channel.send({
    embeds:[new EmbedBuilder()
      .setTitle("🏆 RACE BETTING RESULT")
      .setDescription(
        `Mode: **${mode.toUpperCase()}**\n\n` +
        `${resultText}\n\n` +
        `🎉 Pemenang: ${finish[0].baseEmoji} (Racer #${winnerIndex})\n\n` +
        `🎯 Total Pool: **${totalPool}**
          ${winners.length
          ? `🎁 Pemenang:\n${rewardText}`
          : rewardText}`
      )
      .setColor(0xffd700)
    ]
  });
activeBets.delete(state.raceId);
  // activeBets.delete(race.id);
}

module.exports = { startAutoRace, activeBets, buildLobbyEmbed  };