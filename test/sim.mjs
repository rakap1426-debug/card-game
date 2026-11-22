// Self-check: AI plays both sides across many seeds; every game must end, no crashes, decks roughly balanced.
import { newGame, startTurn, playCard, attack } from '../game/src/engine.js';
import { aiNextAction } from '../game/src/ai.js';
import { DECKS } from '../game/src/cards.js';
import assert from 'node:assert';

function play(a, b, seed) {
  const g = newGame(a, b, seed);
  let p = 0;
  for (let turn = 0; turn < 200 && g.winner === null; turn++) {
    startTurn(g, p);
    for (let step = 0; step < 60 && g.winner === null; step++) {
      const act = aiNextAction(g, p);
      if (act.kind === 'end') break;
      const ev = act.kind === 'play' ? playCard(g, p, act.i, act.target) : attack(g, p, act.uid, act.target);
      assert(ev, 'AI chose illegal action ' + JSON.stringify(act));
    }
    p = 1 - p;
  }
  return g;
}

const wins = Object.fromEntries(DECKS.map((d) => [d.key, [0, 0]]));
let unfinished = 0, turns = 0, n = 0;
for (let s = 1; s <= 40; s++) {
  for (const a of DECKS) for (const b of DECKS) {
    const g = play(a.key, b.key, s * 7919);
    n++; turns += g.turnNo;
    if (g.winner === null) unfinished++;
    else wins[(g.winner === 0 ? a : b).key][0]++;
    wins[a.key][1]++; wins[b.key][1]++;
  }
}
console.log('games', n, 'avg turns', (turns / n).toFixed(1), 'unfinished', unfinished);
for (const k in wins) console.log(k, (wins[k][0] / wins[k][1]).toFixed(2));
assert.equal(unfinished, 0);
for (const k in wins) assert(wins[k][0] / wins[k][1] > 0.3 && wins[k][0] / wins[k][1] < 0.7, 'deck imbalance ' + k);
console.log('ok');
