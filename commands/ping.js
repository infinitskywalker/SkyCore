// module.exports = {
//   name: 'ping',
//   execute(message) {
//     message.reply('🏓 pong!');
//   }
// };
module.exports = {
  name: 'ping',
  async execute(message) {
    const sent = await message.reply('🏓 Pong!');

    const latency = sent.createdTimestamp - message.createdTimestamp;
    // const apiPing = message.client.ws.ping;
    // 📡 Latency: ${latency}  ms
    // Latency is the time it takes for the bot to respond to your command. Lower latency means a faster response! 
    // 🤖 API Ping: ${apiPing} ms

    sent.edit(`🏓 Pong!
📡 Latency: ${latency} ms
`);
  }
};