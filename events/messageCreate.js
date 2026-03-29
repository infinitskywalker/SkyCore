module.exports = {
  name: 'messageCreate',
  execute(message, client) {
    if (message.author.bot) return;

    const prefix = process.env.PREFIX;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    command.execute(message, args);
  }
};