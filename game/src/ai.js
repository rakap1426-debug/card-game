// Opponent brain: greedy planner. Returns one action at a time so the UI can animate between steps.
import { CARD_BY_ID } from './cards.js';
import { canPlay, validTargets, attackTargets, findUnit, suitBonus } from './engine.js';

let ME = 1; // side the AI plays; set per call by aiNextAction

// Score a trade: killing a pricey unit and surviving is great, losing a unit for nothing is bad.
function scoreAttack(g, a, t) {
  const foe = g.players[1 - ME];
  if (t.kind === 'player') return a.atk >= foe.hp ? 1000 : 6 + a.atk * 2 + (foe.board.length ? 0 : 4);
  const d = findUnit(g, t.uid).u;
  const dmg = a.atk + suitBonus(a, d);
  const back = d.atk + suitBonus(d, a);
  const kills = !d.shield && dmg >= d.hp;
  const dies = (!kills || false) && back >= a.hp;
  const dCost = CARD_BY_ID[d.id].cost;
  const aCost = CARD_BY_ID[a.id].cost;
  let s = 0;
  if (kills) s += 8 + dCost * 2 + d.atk;
  else s += Math.min(dmg, d.hp);
  if (dies) s -= 6 + aCost * 2;
  if (d.shield) s -= 2;
  return s;
}

function bestAttack(g) {
  let best = null;
  g.players[ME].board.forEach((a) => {
    attackTargets(g, ME, a.uid).forEach((t) => {
      const s = scoreAttack(g, a, t);
      if (!best || s > best.s) best = { s, a, t };
    });
  });
  return best && best.s > 0 ? best : null;
}

function scoreCard(g, i) {
  const pl = g.players[ME];
  const c = CARD_BY_ID[pl.hand[i]];
  const foe = g.players[1 - ME];
  let best = { s: -1, target: null };
  const consider = (s, target) => { if (s > best.s) best = { s, target }; };
  if (c.type === 'unit') {
    let s = c.cost * 3 + c.atk + c.hp * 0.5;
    if (foe.board.some((u) => CARD_BY_ID[u.id].suit && suitBonus({ id: c.id }, u))) s += 2;
    consider(s, null);
  } else if (c.fx.sweep) {
    const kills = foe.board.filter((u) => !u.shield && u.hp <= c.fx.sweep).length;
    if (kills || foe.board.length >= 3) consider(8 + kills * 6 + foe.board.length * 2, null);
  } else if (c.fx.draw) consider(pl.hand.length < 5 ? 7 : 2, null);
  else {
    for (const t of validTargets(g, ME, i)) {
      if (c.fx.dmg) {
        if (t.kind === 'player') consider(foe.hp <= c.fx.dmg ? 1000 : foe.hp <= 8 ? 9 : 3, t);
        else {
          const u = findUnit(g, t.uid).u;
          const kills = !u.shield && u.hp <= c.fx.dmg;
          if (kills) consider(6 + CARD_BY_ID[u.id].cost * 3 - c.cost, t);
        }
      } else if (c.fx.heal) {
        if (t.kind === 'player') consider(pl.hp <= 12 ? 8 : 0, t);
        else {
          const u = findUnit(g, t.uid).u;
          consider(u.maxHp - u.hp >= 3 ? 5 + (u.maxHp - u.hp) : 0, t);
        }
      } else if (c.fx.atk) {
        const u = findUnit(g, t.uid).u;
        consider(5 + u.atk + (u.ready ? 2 : 0), t);
      }
    }
  }
  return { ...best, i, c };
}

export function aiNextAction(g, side = 1) {
  ME = side;
  const pl = g.players[ME];
  // Lethal-first: cast burn at face, then unit plays, then attacks, then end.
  const options = pl.hand.map((_, i) => i).filter((i) => canPlay(g, ME, i)).map((i) => scoreCard(g, i)).filter((o) => o.s > 0);
  options.sort((a, b) => b.s - a.s);
  const atk = bestAttack(g);
  // Develop board before attacking, unless an attack is lethal.
  if (atk && atk.s >= 1000) return { kind: 'attack', uid: atk.a.uid, target: atk.t };
  if (options.length && options[0].s >= 1000) return { kind: 'play', i: options[0].i, target: options[0].target };
  // Attack first when the trade is clearly good (frees board), otherwise play cards first.
  if (atk && atk.s >= 14) return { kind: 'attack', uid: atk.a.uid, target: atk.t };
  if (options.length) return { kind: 'play', i: options[0].i, target: options[0].target };
  if (atk) return { kind: 'attack', uid: atk.a.uid, target: atk.t };
  return { kind: 'end' };
}
