const Game = require('../games/bombArenaLogic');

const ALLOWED_ROLE_IDS = ["1394327915210215434", "1476816118210498642", "1486314222009712660"];

module.exports = {
  name: 'bomb',
  description: 'Start Bomb Arena',
  execute: async (message, args) => {

    const hasPermission = message.member.roles.cache.some(role =>
      ALLOWED_ROLE_IDS.includes(role.id)
    );

    if (!hasPermission) {
      const msg = await message.reply("⚠️ No permission!");
      setTimeout(() => msg.delete().catch(()=>{}), 5000);
      return;
    }

    message.delete().catch(()=>{});

    const arg = args[0];
    let customTime;

    if(arg === "random") customTime = "random";
    else if(!isNaN(arg)) customTime = parseInt(arg);

    Game.startGame(message.channel, message.author, customTime);
  },
};