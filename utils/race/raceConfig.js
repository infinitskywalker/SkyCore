// utils/race/raceConfig.js

const TRACK_LENGTH = 48;

const MODE_CONFIG = {
  normal: { tick: 1500, baseMove: [3,5], boostChance: 0.1, lagChance: 0.05 },
  fast:   { tick: 900,  baseMove: [4,7], boostChance: 0.15, lagChance: 0.03 },
  chaos:  { tick: 1200, baseMove: [2,6], boostChance: 0.2, lagChance: 0.1 },
};

const RACERS_EMOJIS = [
  "🐸","🦆","🐧","🦀","🐙","🦑","🐡","🦞","🐹","🦔","🦦","🦥","🐼",
  "🦘","🦙","🐨","🦁","🐯","🐻","🐷","🐵","🐔","🦉","🦇","🐴","🦄",
  "🐝","🦋","🐌","🐍","🦎","🦂","🦟","🦗","🐞","🦠","🐲","👾","🤖",
  "🚗","🏎️","🚀","🛸","🚁","🛶","⛵","🛴"
];

const FINISH_FLAG = "🏁";
const TRACK_CHAR = "─";

module.exports = {
  TRACK_LENGTH,
  MODE_CONFIG,
  RACERS_EMOJIS,
  FINISH_FLAG,
  TRACK_CHAR
};