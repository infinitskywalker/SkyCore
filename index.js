require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const express = require("express");

const commandHandler = require('./handlers/commandHandler');
const eventHandler = require('./handlers/eventHandler');

// ===== WEB SERVER (ANTI SLEEP) =====
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.listen(3000, () => {
  console.log("🌐 Web server running...");
});

// ===== DISCORD BOT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

// handler
commandHandler(client);
eventHandler(client);

// ===== ANTI CRASH =====
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

// login
client.login(process.env.TOKEN);