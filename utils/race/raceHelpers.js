// utils/race/raceHelpers.js

const { TRACK_LENGTH, TRACK_CHAR, FINISH_FLAG } = require("./raceConfig");

const sleep = ms => new Promise(r => setTimeout(r, ms));

const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

function buildTrack(position, emoji){
  const pos = Math.min(Math.max(0, Math.floor(position)), TRACK_LENGTH);
  return `\`${TRACK_CHAR.repeat(pos)}${emoji}${TRACK_CHAR.repeat(TRACK_LENGTH-pos)}\`${FINISH_FLAG}`;
}

function getProgress(position){
  return position / TRACK_LENGTH;
}

module.exports = {
  sleep,
  shuffle,
  buildTrack,
  getProgress
};