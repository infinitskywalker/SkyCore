const TRACK_LENGTH = 48;

const MODE_CONFIG = {
  normal: { tick: 1500, baseMove: [3,5], boostChance: 0.1, lagChance: 0.05 }
};

const RACERS_EMOJIS = ["🐸","🦆","🐧","🦀","🐙","🐙","🐡"];

const sleep = ms => new Promise(r=>setTimeout(r,ms));

function track(r){
  const pos = Math.min(Math.floor(r.position), TRACK_LENGTH);
  return `\`${"─".repeat(pos)}${r.emoji}${"─".repeat(TRACK_LENGTH-pos)}\`🏁`;
}

function shuffle(arr){
  return [...arr].sort(()=>Math.random()-0.5);
}

module.exports = {
  TRACK_LENGTH,
  MODE_CONFIG,
  RACERS_EMOJIS,
  sleep,
  track,
  shuffle
};