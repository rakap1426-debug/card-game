// Rules engine: pure state + actions, no DOM. Every action returns a list of events for the UI to animate.
import { CARD_BY_ID, SUITS, buildDeck } from './cards.js';

export const MAX_BOARD = 5;
export const MAX_HAND = 7;
export const START_HP = 20;
export const MAX_MANA = 10;

export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let uidCounter = 1;
const newUnit = (card) => ({ uid: uidCounter++, id: card.id, atk: card.atk, hp: card.hp, maxHp: card.hp, shield: card.ab === 'shield', ready: false });

export function newGame(humanDeck, aiDeck, seed = Date.now()) {
  const rng = makeRng(seed);
  const mk = (key) => ({ hp: START_HP, mana: 0, maxMana: 0, deck: shuffle(buildDeck(key), rng), hand: [], board: [], fatigue: 0, deckKey: key });
  const g = { players: [mk(humanDeck), mk(aiDeck)], turn: 0, turnNo: 0, winner: null, rng, log: [] };
  for (let i = 0; i < 2; i++) for (let k = 0; k < (i === 0 ? 3 : 4); k++) draw(g, i, []);
  return g;
}

function draw(g, p, ev) {
  const pl = g.players[p];
  if (!pl.deck.length) {
    pl.fatigue++;
    damagePlayer(g, p, pl.fatigue, ev);
    ev.push({ t: 'fatigue', p, n: pl.fatigue });
    return;
  }
  const id = pl.deck.pop();
  if (pl.hand.length >= MAX_HAND) ev.push({ t: 'burn', p, id });
  else {
    pl.hand.push(id);
    ev.push({ t: 'draw', p, id });
  }
}

export function startTurn(g, p) {
  const ev = [];
  const pl = g.players[p];
  g.turn = p;
  g.turnNo++;
  pl.maxMana = Math.min(MAX_MANA, pl.maxMana + 1);
  pl.mana = pl.maxMana;
  pl.board.forEach((u) => (u.ready = true));
  ev.push({ t: 'turn', p });
  draw(g, p, ev);
  return ev;
}

function damagePlayer(g, p, n, ev) {
  if (n <= 0) return;
  const pl = g.players[p];
  pl.hp -= n;
  ev.push({ t: 'hurt', p, n });
  if (pl.hp <= 0 && g.winner === null) {
    pl.hp = 0;
    g.winner = 1 - p;
    ev.push({ t: 'over', winner: g.winner });
  }
}

function healPlayer(g, p, n, ev) {
  const pl = g.players[p];
  const got = Math.min(n, START_HP - pl.hp);
  if (got > 0) {
    pl.hp += got;
    ev.push({ t: 'healP', p, n: got });
  }
}

// Deal n damage to a unit. Returns damage actually dealt to hp (0 if the shield soaked it).
function hitUnit(g, p, u, n, ev) {
  if (n <= 0) return 0;
  if (u.shield) {
    u.shield = false;
    ev.push({ t: 'shieldPop', uid: u.uid });
    return 0;
  }
  const dealt = Math.min(n, u.hp);
  u.hp -= n;
  ev.push({ t: 'hurtU', uid: u.uid, n });
  return dealt;
}

function reap(g, ev) {
  for (let p = 0; p < 2; p++) {
    const pl = g.players[p];
    pl.board = pl.board.filter((u) => {
      if (u.hp > 0) return true;
      ev.push({ t: 'die', uid: u.uid, p, id: u.id });
      return false;
    });
  }
}

export const findUnit = (g, uid) => {
  for (let p = 0; p < 2; p++) {
    const u = g.players[p].board.find((x) => x.uid === uid);
    if (u) return { u, p };
  }
  return null;
};

export const suitBonus = (a, b) => (SUITS[CARD_BY_ID[a.id].suit].beats === CARD_BY_ID[b.id].suit ? 1 : 0);

export function canPlay(g, p, handIdx) {
  const pl = g.players[p];
  const c = CARD_BY_ID[pl.hand[handIdx]];
  if (g.winner !== null || g.turn !== p || !c || c.cost > pl.mana) return false;
  if (c.type === 'unit') return pl.board.length < MAX_BOARD;
  if (c.target === 'allyUnit') return pl.board.length > 0;
  return true;
}

// target: {kind:'unit',uid} | {kind:'player',p} | null
export function validTargets(g, p, handIdx) {
  const c = CARD_BY_ID[g.players[p].hand[handIdx]];
  const out = [];
  if (!c || c.type !== 'spell' || c.target === 'none') return out;
  const mine = g.players[p].board.map((u) => ({ kind: 'unit', uid: u.uid }));
  const theirs = g.players[1 - p].board.map((u) => ({ kind: 'unit', uid: u.uid }));
  if (c.target === 'enemy') out.push(...theirs, { kind: 'player', p: 1 - p });
  if (c.target === 'ally') out.push(...mine, { kind: 'player', p });
  if (c.target === 'allyUnit') out.push(...mine);
  return out;
}

export function playCard(g, p, handIdx, target) {
  if (!canPlay(g, p, handIdx)) return null;
  const pl = g.players[p];
  const c = CARD_BY_ID[pl.hand[handIdx]];
  if (c.type === 'spell' && c.target !== 'none') {
    const ok = validTargets(g, p, handIdx).some((t) => t.kind === target?.kind && t.uid === target.uid && t.p === target.p);
    if (!ok) return null;
  }
  const ev = [];
  pl.hand.splice(handIdx, 1);
  pl.mana -= c.cost;
  if (c.type === 'unit') {
    const u = newUnit(c);
    pl.board.push(u);
    ev.push({ t: 'summon', p, uid: u.uid, id: c.id });
  } else {
    ev.push({ t: 'cast', p, id: c.id, target });
    const fx = c.fx;
    const tu = target?.kind === 'unit' ? findUnit(g, target.uid) : null;
    if (fx.dmg) {
      if (tu) hitUnit(g, tu.p, tu.u, fx.dmg, ev);
      else damagePlayer(g, target.p, fx.dmg, ev);
    }
    if (fx.heal) {
      if (tu) {
        tu.u.hp = Math.min(tu.u.maxHp, tu.u.hp + fx.heal);
        ev.push({ t: 'healU', uid: tu.u.uid, n: fx.heal });
      } else healPlayer(g, target.p, fx.heal, ev);
    }
    if (fx.atk) {
      tu.u.atk += fx.atk;
      tu.u.hp += fx.hp;
      tu.u.maxHp += fx.hp;
      ev.push({ t: 'buff', uid: tu.u.uid });
    }
    if (fx.sweep) g.players[1 - p].board.forEach((u) => hitUnit(g, 1 - p, u, fx.sweep, ev));
    if (fx.draw) for (let i = 0; i < fx.draw; i++) draw(g, p, ev);
    reap(g, ev);
  }
  return ev;
}

export function canAttack(g, p, uid) {
  const u = g.players[p].board.find((x) => x.uid === uid);
  return !!u && u.ready && g.turn === p && g.winner === null;
}

export function attackTargets(g, p, uid) {
  if (!canAttack(g, p, uid)) return [];
  const foes = g.players[1 - p].board;
  if (!foes.length) return [{ kind: 'player', p: 1 - p }];
  return foes.map((u) => ({ kind: 'unit', uid: u.uid }));
}

export function attack(g, p, uid, target) {
  const ok = attackTargets(g, p, uid).some((t) => t.kind === target?.kind && t.uid === target.uid && t.p === target.p);
  if (!ok) return null;
  const ev = [];
  const a = g.players[p].board.find((x) => x.uid === uid);
  const card = CARD_BY_ID[a.id];
  a.ready = false;
  if (target.kind === 'player') {
    ev.push({ t: 'strike', uid, target });
    damagePlayer(g, target.p, a.atk, ev);
    if (card.ab === 'drain') healPlayer(g, p, a.atk, ev);
  } else {
    const d = findUnit(g, target.uid).u;
    const dc = CARD_BY_ID[d.id];
    ev.push({ t: 'strike', uid, target });
    const dmgOut = a.atk + suitBonus(a, d);
    const dmgBack = d.atk + suitBonus(d, a);
    const dealt = hitUnit(g, 1 - p, d, dmgOut, ev);
    if (card.ab === 'drain') healPlayer(g, p, dealt, ev);
    if (card.ab === 'pierce' && d.hp < 0 && dealt > 0) damagePlayer(g, 1 - p, -d.hp, ev);
    if (d.hp > 0 || dealt === 0) {
      hitUnit(g, p, a, dmgBack, ev);
      if (dc.ab === 'drain') healPlayer(g, 1 - p, Math.min(dmgBack, 99), ev);
    }
  }
  reap(g, ev);
  return ev;
}

export function endTurn(g, p) {
  return g.turn === p && g.winner === null ? [{ t: 'end', p }] : [];
}
