module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`✅ Bot online sebagai ${client.user.tag}`);
  }
};