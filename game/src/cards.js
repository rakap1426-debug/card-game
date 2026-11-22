// Card catalogue for EMBERFALL DUEL: suits, units, spells and deck building.
// Suit wheel: ember > moss > tide > ember (+1 damage on a winning matchup). gale is neutral but quick.
const SUITS = {
  ember: { name: 'Ember', color: '#e8553a', dark: '#7a1f12', beats: 'moss', icon: 'flame' },
  tide: { name: 'Tide', color: '#3aa0e8', dark: '#12467a', beats: 'ember', icon: 'drop' },
  moss: { name: 'Moss', color: '#4cc46a', dark: '#175a2a', beats: 'tide', icon: 'leaf' },
  gale: { name: 'Gale', color: '#f0c43c', dark: '#7a5c0a', beats: null, icon: 'bolt' },
};
const SUIT_ORDER = ['ember', 'tide', 'moss', 'gale'];

// ab: pierce = excess damage hits the player, shield = ignores the first hit, drain = heals owner by damage dealt
const U = (id, name, suit, cost, atk, hp, ab) => ({ id, type: 'unit', name, suit, cost, atk, hp, ab: ab || '' });
const S = (id, name, suit, cost, fx, target, text) => ({ id, type: 'spell', name, suit, cost, fx, target, text });

const CARDS = [
  U('imp', 'Cinder Imp', 'ember', 1, 2, 1),
  U('hound', 'Ashhound', 'ember', 2, 3, 2),
  U('warden', 'Forge Warden', 'ember', 3, 3, 4),
  U('brute', 'Magma Brute', 'ember', 4, 5, 4),
  U('drake', 'Pyre Drake', 'ember', 5, 5, 5, 'pierce'),
  U('titan', 'Sunscar Titan', 'ember', 7, 8, 7),
  U('sprite', 'Brine Sprite', 'tide', 1, 1, 2, 'shield'),
  U('reef', 'Reef Guard', 'tide', 2, 2, 3),
  U('caller', 'Tidecaller', 'tide', 3, 3, 3, 'drain'),
  U('lurker', 'Deep Lurker', 'tide', 4, 4, 5),
  U('serpent', 'Storm Serpent', 'tide', 5, 4, 6, 'drain'),
  U('leviathan', 'Leviathan', 'tide', 7, 7, 9),
  U('sprout', 'Thorn Sprout', 'moss', 1, 1, 3),
  U('pup', 'Bramble Pup', 'moss', 2, 2, 3),
  U('sentinel', 'Oak Sentinel', 'moss', 3, 2, 6, 'shield'),
  U('stalker', 'Fang Stalker', 'moss', 4, 5, 3, 'pierce'),
  U('treant', 'Elder Treant', 'moss', 5, 4, 8),
  U('worldroot', 'Worldroot', 'moss', 7, 6, 10, 'shield'),
  U('mote', 'Zephyr Mote', 'gale', 1, 2, 1, 'pierce'),
  U('kite', 'Kite Rider', 'gale', 2, 2, 2, 'pierce'),
  U('knight', 'Sky Knight', 'gale', 3, 3, 3, 'shield'),
  U('hawk', 'Storm Hawk', 'gale', 4, 4, 3, 'pierce'),
  U('cloud', 'Cloud Warden', 'gale', 5, 4, 5, 'drain'),
  U('queen', 'Tempest Queen', 'gale', 6, 6, 5, 'pierce'),
  S('spark', 'Spark', 'ember', 1, { dmg: 2 }, 'enemy', 'Deal 2 damage to a unit or the foe'),
  S('meteor', 'Meteor', 'ember', 4, { dmg: 5 }, 'enemy', 'Deal 5 damage to a unit or the foe'),
  S('mend', 'Mend', 'moss', 2, { heal: 5 }, 'ally', 'Heal 5 on one of your units or yourself'),
  S('overgrow', 'Overgrowth', 'moss', 2, { atk: 2, hp: 2 }, 'allyUnit', 'Your unit gets +2/+2'),
  S('wave', 'Tidal Wave', 'tide', 3, { sweep: 2 }, 'none', 'Deal 2 damage to every enemy unit'),
  S('insight', 'Insight', 'gale', 1, { draw: 2 }, 'none', 'Draw 2 cards'),
];
const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

const AB_TEXT = { pierce: 'Pierce: extra damage hits the foe', shield: 'Shield: blocks the first hit', drain: 'Drain: heals you when it hits' };

// Decks: 6 units of the main suit x2, 6 units of a splash suit x1, 6 spells x2 = 30 cards.
const DECKS = [
  { key: 'ember', name: 'Cinderhost', blurb: 'Fast fire. Burns moss, fears tide.', main: 'ember', splash: 'gale' },
  { key: 'tide', name: 'Deepcurrent', blurb: 'Drain and outlast. Douses ember.', main: 'tide', splash: 'moss' },
  { key: 'moss', name: 'Rootwarden', blurb: 'Tough walls that shrug off tide.', main: 'moss', splash: 'ember' },
  { key: 'gale', name: 'Skyraiders', blurb: 'Pierce past blockers to the throat.', main: 'gale', splash: 'tide' },
];

function buildDeck(deckKey) {
  const d = DECKS.find((x) => x.key === deckKey) || DECKS[0];
  const ids = [];
  CARDS.filter((c) => c.type === 'unit' && c.suit === d.main).forEach((c) => ids.push(c.id, c.id));
  CARDS.filter((c) => c.type === 'unit' && c.suit === d.splash).forEach((c) => ids.push(c.id));
  CARDS.filter((c) => c.type === 'spell').forEach((c) => ids.push(c.id, c.id));
  return ids;
}

export { SUITS, SUIT_ORDER, CARDS, CARD_BY_ID, DECKS, AB_TEXT, buildDeck };
