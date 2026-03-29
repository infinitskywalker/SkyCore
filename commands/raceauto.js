const raceAuto = require('../games/raceAutoLogic');

const ALLOWED_ROLE_IDS = ["1394327915210215434", "1476816118210498642", "1486314222009712660"];

module.exports = {
  name: 'raceauto',
  execute: async (message, args) => {

    const hasPermission = message.member.roles.cache.some(role =>
      ALLOWED_ROLE_IDS.includes(role.id)
    );

    if (!hasPermission) {
      const msg = await message.reply("⚠️ Tidak punya akses!");
      setTimeout(() => msg.delete().catch(()=>{}), 5000);
      return;
    }

    message.delete().catch(()=>{});

    const count = parseInt(args[0]) || 2;
    const mode = args[1] || "normal";

    raceAuto.startAutoRace(message.channel, count, mode);
  },
};