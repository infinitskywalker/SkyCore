const { EmbedBuilder } = require("discord.js");
// const { activeBets } = require('../../games/raceAutoLogic');
const { activeBets, buildLobbyEmbed } = require('../../games/raceAutoLogic');
module.exports = {
  name: 'jb',
  execute: async (message) => {

    const raceEntry = [...activeBets.entries()]
      .find(([_, r]) => r.open && r.channelId === message.channel.id);

    if (!raceEntry) 
      return message.reply("❌ Tidak ada race aktif!");

    const [raceId, raceData] = raceEntry;

    if(message.author.id !== raceData.hostId){
      return message.reply("❌ Hanya bandar yang bisa approve player!");
    }

    const user = message.mentions.users.first();
    if(!user) return message.reply("❌ Tag user yang mau di-approve!");

    if(raceData.approvedPlayers.includes(user.id)){
      return message.reply(`⚠️ ${user.username} sudah di-approve!`);
    }

    // ✅ MASUKKAN KE DATA
    raceData.approvedPlayers.push(user.id);
if(raceData.lobbyMessage){
  await message.channel.send({
  embeds: [buildLobbyEmbed(raceData)]
});
  // await raceData.lobbyMessage.edit({
  //   embeds: [buildLobbyEmbed(raceData)]
  // }).catch(()=>{});
}
    // ===== 🔥 UPDATE LOBBY =====
    // if(raceData.lobbyMessage){
    //   const updatedEmbed = new EmbedBuilder()
    //     .setTitle("🎲 RACE SETUP")
    //     .setDescription(
    //       `👤 Host: <@${raceData.hostId}>\n` +
    //       `🕹️ Mode: ⚪ **${raceData.mode.toUpperCase()}**\n` +
    //       `🏎️ Total Racers: **${raceData.totalRacers}**\n` +
    //       `💰 Bet: **${raceData.betAmount/1000}K** 💸\n\n` +
    //       `🟢 Approved Players:\n${
    //         raceData.approvedPlayers.map(id=>`<@${id}>`).join("\n") || "Belum ada pemain"
    //       }`
    //     )
    //     .setColor(0x5865f2);

    //   await raceData.lobbyMessage.edit({
    //     embeds: [updatedEmbed]
    //   }).catch(()=>{});
    // }

    return message.reply(`✅ ${user.username} sudah di-approve!`);
  }
};