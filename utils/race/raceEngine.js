// utils/race/raceEngine.js

const { getProgress } = require("./raceHelpers");

function calculateMove(r, config, mode){
  let move = config.baseMove[0] + Math.random()*(config.baseMove[1]-config.baseMove[0]);
  const progress = getProgress(r.position);

  let event = null;

  const eventChance = mode === "chaos" ? 0.55 : 0.08;

  if(Math.random() < eventChance){
    const rand = Math.random();

    if(rand < 0.2){ move += 4; event="🚀"; }
    else if(rand < 0.35){ move -= 3; event="🍌"; }
    else if(rand < 0.5){ r.stunned = 2; move = 0; event="⚡"; }
    else if(rand < 0.65){ r.position -= 3; move = 0; event="💥"; }
    else if(progress < 0.5){ move += 5; event="🔥"; }
    else if(progress > 0.7 && Math.random()<0.25){ move-=2; event="😵"; }
    else if(progress < 0.4 && Math.random()<0.3){ move+=2; event="🔥"; }
  }

  // scaling
  if(progress > 0.8) move *= 0.6;

  // rng
  if(Math.random()<config.boostChance*(1-progress)) move+=2;
  if(Math.random()<config.lagChance*(1-progress/2)) move-=1;

  return {
    move: Math.max(1, Math.round(move)),
    event
  };
}

module.exports = { calculateMove };