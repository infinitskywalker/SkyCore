const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require("discord.js");

const activeGames = new Map();
const MIN_PLAYERS = 2;
const MIN_TURN_TIME = 4000;

function getRandom(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}

function progressBar(timeLeft, max){
  const total = 10;
  const filled = Math.max(0, Math.round((timeLeft/max)*total));
  return "█".repeat(filled) + "░".repeat(total-filled);
}

module.exports = {
  startGame(channel, host, customTime){

    if(activeGames.has(channel.id)){
      return channel.send("❌ Game already running!");
    }

    let baseTime =
      customTime === "random" || !customTime
        ? Math.floor(Math.random()*6000)+14000
        : parseInt(customTime)*1000;

    const game = {
      hostId: host.id,
      players: [],
      alive: [],
      ghosts: [],
      bombHolder: null,

      baseTimer: baseTime,
      timer: baseTime,

      round: 0,
      passChain: 0,
      noPass: false,
      targetLock: null,

      cooldowns: new Map(),
      ghostCooldowns: new Map(),
      ghostEnergy: new Map()
    };

    activeGames.set(channel.id, game);

    // ===== LOBBY =====
    let timeLeft = 20;

    const getEmbed = () => new EmbedBuilder()
      .setTitle("💣 Bomb Arena Lobby")
      .setDescription(
        `⏳ ${timeLeft}s\n\n👥 Player (${game.players.length}):\n` +
        (game.players.map(p=>`- ${p}`).join("\n") || "Belum ada")
      )
      .setColor("Red");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("join").setLabel("Join").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("start").setLabel("Start").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("how").setLabel("📖 How").setStyle(ButtonStyle.Secondary)
    );

    channel.send({ embeds:[getEmbed()], components:[row] }).then(msg=>{

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 20000
      });

      const interval = setInterval(()=>{
        timeLeft--;
        msg.edit({ embeds:[getEmbed()] }).catch(()=>{});
        if(timeLeft<=0) clearInterval(interval);
      },1000);

      collector.on("collect", async i => {

        if(i.customId === "join"){
          if(game.players.find(p=>p.id===i.user.id)){
            return i.reply({ content:"❌ Sudah join!", ephemeral:true });
          }
          game.players.push(i.user);
          return i.reply({ content:`${i.user.displayName} join ✅`, ephemeral:true });
        }

        if(i.customId === "start"){
          if(i.user.id !== game.hostId){
            return i.reply({ content:"❌ Hanya host!", ephemeral:true });
          }
          if(game.players.length < MIN_PLAYERS){
            return i.reply({ content:"❌ Player kurang!", ephemeral:true });
          }
          collector.stop("start");
        }

        if(i.customId === "how"){
          return i.reply({
            content:
`🎯 Jangan pegang bomb saat waktu habis!

⌨️ COMMAND:
p @user → lempar 💣
r → random
d → disarm (risk)
f @user → duel

💀 Jangan diem!`,
            ephemeral:true
          });
        }
      });

      collector.on("end", ()=>{
        clearInterval(interval);

        if(game.players.length < MIN_PLAYERS){
          activeGames.delete(channel.id);
          return channel.send("❌ Player kurang.");
        }

        game.alive = [...game.players];
        game.bombHolder = getRandom(game.alive);

        runTurn(channel, game);
      });
    });
  }
};

// ===== TURN =====

async function runTurn(channel, game){

  if(game.alive.length <= 1){
    const winner = game.alive[0];
    activeGames.delete(channel.id);
    return channel.send(`🏆 WINNER: ${winner}`);
  }

  game.round++;

  // ===== TIMER SCALING =====
  const base = game.baseTimer;
  game.timer = Math.max(
    MIN_TURN_TIME,
    base - (6 - game.alive.length) * 1500
  );

  let timeLeft = game.timer;
  let actionTaken = false;

  const msgUI = await channel.send("...");

  // ===== TUTORIAL =====
//   if(game.round === 1){
//     channel.send(
// `🎓 QUICK GUIDE:
// Ketik cepat!

// p @user → lempar 💣
// r → random
// d → nekat
// f @user → duel`
//     );
//   }

  // ===== HINT =====
  setTimeout(()=>{
    channel.send(`⏰ ${game.bombHolder}, cepat! ketik p @user / r`);
  },2000);

  const ui = setInterval(()=>{
    msgUI.edit({
      embeds:[
        new EmbedBuilder()
          .setTitle("💣 Bomb Arena")
          .setDescription(
`💣 HOLDER:
👉 ${game.bombHolder}

⏳ ${progressBar(timeLeft, game.timer)}

👥 ${game.alive.join(", ")}

⚡ p @user | r | d | f @user`
          )
          .setColor("Red")
      ]
    }).catch(()=>{});

    timeLeft -= 500;
    if(timeLeft<=0) clearInterval(ui);
  },500);

  const collector = channel.createMessageCollector({ time: game.timer });

  collector.on("collect", msg => {

    const args = msg.content.toLowerCase().split(" ");
    const cmd = args[0];

    // ===== GHOST =====
    if(game.ghosts.find(g=>g.id===msg.author.id)){
      msg.reply({
        content: "👻 Kamu ghost: curse | panic | swap (cd 8s, max 3x)",
        ephemeral: true
      }).catch(()=>{});

      const now = Date.now();
      const last = game.ghostCooldowns.get(msg.author.id)||0;

      if(now-last<8000) return;

      const energy = game.ghostEnergy.get(msg.author.id)||3;
      if(energy <= 0) return;

      game.ghostEnergy.set(msg.author.id, energy-1);
      game.ghostCooldowns.set(msg.author.id, now);

      if(cmd==="curse"){
        game.timer += 1000;
        channel.send(`😈 Timer bertambah!`);
      }

      if(cmd==="panic"){
        game.timer *= 0.7;
        channel.send(`⚡ PANIC!`);
      }

      if(cmd==="swap"){
        if(Math.random()<0.5){
          game.bombHolder = getRandom(game.alive);
          channel.send(`🔄 Swap!`);
        } else {
          channel.send(`❌ Swap gagal!`);
        }
      }

      return;
    }

    // ===== ONLY HOLDER =====
    if(msg.author.id !== game.bombHolder.id) return;

    const now = Date.now();
    const last = game.cooldowns.get(msg.author.id)||0;
    if(now-last<700) return;

    game.cooldowns.set(msg.author.id, now);
    actionTaken = true;
    collector.stop();

    // ===== PASS =====
    if(cmd==="p"){
      if(game.noPass) return channel.send("🚫 NO PASS!");

      let target = msg.mentions.users.first();
      if(!target) return;

      target = game.alive.find(p=>p.id===target.id);
      if(!target) return;

      game.bombHolder = target;
      game.passChain++;

      channel.send(`📤 ${msg.author} lempar 💣 ke ${target}`);
    }

    // ===== RANDOM =====
    if(cmd==="r"){
      const target = getRandom(game.alive.filter(p=>p.id!==msg.author.id));
      game.bombHolder = target;
      channel.send(`🎲 Random → ${target}`);
    }

    // ===== DISARM =====
    if(cmd==="d"){
      const roll = Math.random();

      if(roll < 0.4){
        const t = getRandom(game.alive.filter(p=>p.id!==msg.author.id));
        game.bombHolder = t;
        channel.send(`🧠 SUCCESS → ${t}`);
      }
      else if(roll < 0.8){
        channel.send(`😬 Gagal, masih hidup!`);
      }
      else{
        channel.send(`💀 GAGAL! ${msg.author} meledak!`);
        eliminate(game, msg.author);
      }
    }

    // ===== DUEL =====
    if(cmd==="f"){
      const target = msg.mentions.users.first();
      if(!target || target.id===msg.author.id) return;

      const t = game.alive.find(p=>p.id===target.id);
      if(!t) return;

      const r1 = Math.floor(Math.random()*100)+1;
      const r2 = Math.floor(Math.random()*100)+1;

      channel.send(`⚔️ ${msg.author}(${r1}) vs ${t}(${r2})`);

      if(r1 > r2){
        game.bombHolder = t;
        channel.send(`💣 ${t} kalah!`);
      } else {
        game.bombHolder = msg.author;
        channel.send(`💣 ${msg.author} kalah!`);
      }
    }
  });

  collector.on("end", ()=>{
    clearInterval(ui);

    if(!actionTaken){
      channel.send(`💥 BOOM! ${game.bombHolder} mati!`);
      eliminate(game, game.bombHolder);
    }

    if(Math.random()<0.25){
      triggerEvent(channel, game);
    }

    setTimeout(()=>runTurn(channel, game), 2000);
  });
}

// ===== EVENT =====
function triggerEvent(channel, game){
  const r = Math.random();

  if(r<0.33){
    game.noPass = true;
    setTimeout(()=>game.noPass=false,3000);

    channel.send(
`🚫 NO PASS (3s)
Holder tidak bisa lempar!
Gunakan: d (disarm) / f @user`
    );
  }

  else if(r<0.66){
    const t = getRandom(game.alive);
    game.targetLock = t.id;
    setTimeout(()=>game.targetLock=null,3000);

    channel.send(
`🎯 TARGET LOCK (3s)
Harus lempar ke ${t}
Selain itu gagal!`
    );
  }

  else{
    game.timer *= 0.6;

    channel.send(
`⚡ PANIC MODE
Timer dipercepat drastis!
Cepat ambil aksi!`
    );
  }
}

// ===== ELIM =====

function eliminate(game, user){
  game.alive = game.alive.filter(p=>p.id!==user.id);
  game.ghosts.push(user);
  game.ghostEnergy.set(user.id, 3);

  if(game.alive.length>0){
    game.bombHolder = getRandom(game.alive);
  }
}