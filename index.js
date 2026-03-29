require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const commandHandler = require('./handlers/commandHandler');
const eventHandler = require('./handlers/eventHandler');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

// jalankan handler
commandHandler(client);
eventHandler(client);

client.login(process.env.TOKEN);

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.listen(3000, () => {
  console.log("Web server running...");
});