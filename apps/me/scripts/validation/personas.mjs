// personas.mjs
// ============================================================================
// Hand-authored test personas for rec engine validation.
//
// Each persona represents a recognizable archetype of tabletop player.
// Their dim_vector + confidence_vector are crafted to evoke that
// archetype clearly enough that "good" recommendations are obvious to
// a human reviewer — and so we can write assertions that fail when
// the engine drifts into incoherent recs.
//
// Naming convention: every persona has player_id `validate-test-<slug>`
// so they're trivially filterable from the rec_seidr_player_profile
// table. The cleanup script (cleanup.mjs) removes all rows matching
// `validate-test-%`.
//
// Expected fits / misses are intentionally a mix of:
//   - Specific BGG IDs (when there's an unambiguous canonical example)
//   - Categorical descriptors (subdomain, complexity range, year range)
//   - Anti-examples (games that should NOT appear)
//
// Calibration philosophy: the assertions should be slightly tight for
// the corpus we have. As the LLM tail run lands and the corpus grows
// to 2600 games, we can both (a) tighten specific-ID expectations and
// (b) add more nuanced personas from real public-forum interaction
// research (Manus follow-up).
// ============================================================================

const TEST_ID_PREFIX = 'validate-test-';

/**
 * @typedef {object} Persona
 * @property {string} id - Stable identifier; becomes player_id with prefix.
 * @property {string} name - Display name for reports.
 * @property {string} narrative - One-paragraph human description.
 * @property {Record<string, number>} profile - 24-dim vector, values in [-1, 1].
 * @property {Record<string, number>} confidence - 24-dim vector, values in [0, 1].
 * @property {object} expectations - What we expect from the recs.
 * @property {string[]} [expectations.subdomainOneOf] - Top recs should fall in these subdomains.
 * @property {[number, number]} [expectations.playingTimeRange] - Avg playing_time should be in this range.
 * @property {[number, number]} [expectations.complexityRange] - Mostly informational; not yet enforceable per-game.
 * @property {number[]} [expectations.shouldAppear] - BGG IDs that should land in top-K.
 * @property {number[]} [expectations.shouldNotAppear] - BGG IDs that should NOT land in top-K.
 * @property {string[]} [expectations.shouldNotMatchSubdomains] - Subdomains that should NOT dominate.
 */

/** Helper to produce a confidence vector with a single value across all dims. */
function uniformConfidence(value) {
  const dims = [
    'PSY_ACHIEVEMENT', 'PSY_EXPLORATION', 'PSY_SOCIAL', 'PSY_KILLER',
    'PSY_OPENNESS', 'PSY_CONSCIENTIOUSNESS', 'PSY_EXTRAVERSION',
    'PSY_AGREEABLENESS', 'PSY_NEUROTICISM',
    'SOC_COOP_COMP', 'SOC_DIRECT_INDIRECT', 'SOC_TRUST_BETRAYAL',
    'MEC_LUCK_SKILL', 'MEC_COMPLEXITY', 'MEC_STRATEGY', 'MEC_ASYMMETRY',
    'AES_THEME_MECH', 'AES_NARRATIVE', 'AES_COMPONENT',
    'CTX_TIME', 'CTX_NOSTALGIA', 'CTX_PLAYER_COUNT',
    'EMO_TENSION', 'EMO_HUMOR',
  ];
  const out = {};
  for (const d of dims) out[d] = value;
  return out;
}

/** @type {Persona[]} */
export const PERSONAS = [
  // ----- The opinionated archetypes -----

  {
    id: 'heavy-strategist',
    name: 'The Heavy Strategist',
    narrative: 'Plays Brass: Birmingham for breakfast. Loves long, deep, deterministic-feeling strategy with elegant economic engines. Hates randomness and short games.',
    profile: {
      PSY_ACHIEVEMENT: 0.85, PSY_EXPLORATION: 0.4, PSY_SOCIAL: -0.2, PSY_KILLER: 0.3,
      PSY_OPENNESS: 0.5, PSY_CONSCIENTIOUSNESS: 0.7, PSY_EXTRAVERSION: -0.1,
      PSY_AGREEABLENESS: 0.0, PSY_NEUROTICISM: -0.2,
      SOC_COOP_COMP: 0.7, SOC_DIRECT_INDIRECT: -0.4, SOC_TRUST_BETRAYAL: -0.2,
      MEC_LUCK_SKILL: 0.85, MEC_COMPLEXITY: 0.8, MEC_STRATEGY: 0.9, MEC_ASYMMETRY: 0.4,
      AES_THEME_MECH: -0.3, AES_NARRATIVE: -0.2, AES_COMPONENT: 0.4,
      CTX_TIME: 0.7, CTX_NOSTALGIA: 0.0, CTX_PLAYER_COUNT: -0.2,
      EMO_TENSION: 0.4, EMO_HUMOR: -0.4,
    },
    confidence: uniformConfidence(0.9),
    expectations: {
      subdomainOneOf: ['Strategy'],
      playingTimeRange: [60, 240],
      complexityRange: [3.0, 5.0],
      shouldNotMatchSubdomains: ['Children', 'Party'],
    },
  },

  {
    id: 'narrative-adventurer',
    name: 'The Narrative Adventurer',
    narrative: 'Lives for stories. Gloomhaven, Pandemic Legacy, anything with a campaign. Cooperative-leaning. Loves rich theme and emergent stories from the table.',
    profile: {
      PSY_ACHIEVEMENT: 0.4, PSY_EXPLORATION: 0.85, PSY_SOCIAL: 0.5, PSY_KILLER: -0.3,
      PSY_OPENNESS: 0.7, PSY_CONSCIENTIOUSNESS: 0.2, PSY_EXTRAVERSION: 0.3,
      PSY_AGREEABLENESS: 0.6, PSY_NEUROTICISM: 0.1,
      SOC_COOP_COMP: -0.7, SOC_DIRECT_INDIRECT: -0.5, SOC_TRUST_BETRAYAL: -0.3,
      MEC_LUCK_SKILL: 0.2, MEC_COMPLEXITY: 0.5, MEC_STRATEGY: 0.4, MEC_ASYMMETRY: 0.6,
      AES_THEME_MECH: 0.7, AES_NARRATIVE: 0.9, AES_COMPONENT: 0.5,
      CTX_TIME: 0.5, CTX_NOSTALGIA: 0.0, CTX_PLAYER_COUNT: -0.3,
      EMO_TENSION: 0.5, EMO_HUMOR: 0.0,
    },
    confidence: uniformConfidence(0.85),
    expectations: {
      subdomainOneOf: ['Strategy', 'Thematic', 'Customizable'],
      shouldAppear: [174430, 291457, 285774], // Gloomhaven, Gloomhaven: JotL, Marvel Champions
    },
  },

  {
    id: 'party-host',
    name: 'The Party Host',
    narrative: 'Hosts game nights for groups of 6+ that include casual players. Wants quick games with high humor, low complexity, and easy onboarding. Codenames is the comfort food.',
    profile: {
      PSY_ACHIEVEMENT: -0.2, PSY_EXPLORATION: 0.2, PSY_SOCIAL: 0.9, PSY_KILLER: -0.2,
      PSY_OPENNESS: 0.4, PSY_CONSCIENTIOUSNESS: -0.3, PSY_EXTRAVERSION: 0.85,
      PSY_AGREEABLENESS: 0.5, PSY_NEUROTICISM: -0.4,
      SOC_COOP_COMP: -0.1, SOC_DIRECT_INDIRECT: 0.3, SOC_TRUST_BETRAYAL: 0.4,
      MEC_LUCK_SKILL: -0.2, MEC_COMPLEXITY: -0.8, MEC_STRATEGY: -0.4, MEC_ASYMMETRY: 0.0,
      AES_THEME_MECH: 0.2, AES_NARRATIVE: -0.3, AES_COMPONENT: 0.0,
      CTX_TIME: -0.7, CTX_NOSTALGIA: 0.2, CTX_PLAYER_COUNT: 0.85,
      EMO_TENSION: 0.3, EMO_HUMOR: 0.85,
    },
    confidence: uniformConfidence(0.85),
    expectations: {
      subdomainOneOf: ['Party', 'Family'],
      playingTimeRange: [10, 60],
      shouldNotMatchSubdomains: ['Wargame', 'Strategy'],
    },
  },

  {
    id: 'wargamer',
    name: 'The Wargamer',
    narrative: 'Hex-and-counter sympathetic but COIN-curious. Long games are fine; that\'s the point. Direct conflict, asymmetric powers, deep history.',
    profile: {
      PSY_ACHIEVEMENT: 0.6, PSY_EXPLORATION: 0.3, PSY_SOCIAL: -0.4, PSY_KILLER: 0.7,
      PSY_OPENNESS: 0.2, PSY_CONSCIENTIOUSNESS: 0.6, PSY_EXTRAVERSION: -0.2,
      PSY_AGREEABLENESS: -0.3, PSY_NEUROTICISM: -0.1,
      SOC_COOP_COMP: 0.6, SOC_DIRECT_INDIRECT: 0.85, SOC_TRUST_BETRAYAL: 0.2,
      MEC_LUCK_SKILL: 0.4, MEC_COMPLEXITY: 0.85, MEC_STRATEGY: 0.85, MEC_ASYMMETRY: 0.7,
      AES_THEME_MECH: 0.7, AES_NARRATIVE: 0.4, AES_COMPONENT: 0.3,
      CTX_TIME: 0.85, CTX_NOSTALGIA: 0.0, CTX_PLAYER_COUNT: -0.5,
      EMO_TENSION: 0.7, EMO_HUMOR: -0.6,
    },
    confidence: uniformConfidence(0.9),
    expectations: {
      subdomainOneOf: ['Wargame', 'Strategy'],
      playingTimeRange: [90, 360],
      shouldNotMatchSubdomains: ['Children', 'Party', 'Family'],
    },
  },

  {
    id: 'family-player',
    name: 'The Family Player',
    narrative: 'Plays with kids 7-12 and a partner. Wants games that are easy to teach, take 30-60 minutes, and don\'t make anyone cry. Ticket to Ride / Carcassonne / Catan zone.',
    profile: {
      PSY_ACHIEVEMENT: 0.1, PSY_EXPLORATION: 0.3, PSY_SOCIAL: 0.6, PSY_KILLER: -0.5,
      PSY_OPENNESS: 0.0, PSY_CONSCIENTIOUSNESS: 0.0, PSY_EXTRAVERSION: 0.4,
      PSY_AGREEABLENESS: 0.7, PSY_NEUROTICISM: 0.0,
      SOC_COOP_COMP: 0.0, SOC_DIRECT_INDIRECT: -0.6, SOC_TRUST_BETRAYAL: -0.6,
      MEC_LUCK_SKILL: 0.0, MEC_COMPLEXITY: -0.4, MEC_STRATEGY: -0.1, MEC_ASYMMETRY: -0.2,
      AES_THEME_MECH: 0.2, AES_NARRATIVE: 0.0, AES_COMPONENT: 0.3,
      CTX_TIME: -0.4, CTX_NOSTALGIA: 0.3, CTX_PLAYER_COUNT: 0.2,
      EMO_TENSION: -0.2, EMO_HUMOR: 0.4,
    },
    confidence: uniformConfidence(0.8),
    expectations: {
      subdomainOneOf: ['Family', 'Children', 'Party'],
      playingTimeRange: [20, 75],
      shouldNotMatchSubdomains: ['Wargame'],
    },
  },

  {
    id: 'two-player-couple',
    name: 'The Two-Player Couple',
    narrative: 'Plays exclusively head-to-head with a partner. Wants tight, interactive, asymmetric games with depth that scale to 2 well. Patchwork / 7 Wonders Duel / Jaipur.',
    profile: {
      PSY_ACHIEVEMENT: 0.5, PSY_EXPLORATION: 0.4, PSY_SOCIAL: 0.5, PSY_KILLER: 0.2,
      PSY_OPENNESS: 0.4, PSY_CONSCIENTIOUSNESS: 0.4, PSY_EXTRAVERSION: 0.0,
      PSY_AGREEABLENESS: 0.4, PSY_NEUROTICISM: -0.1,
      SOC_COOP_COMP: 0.4, SOC_DIRECT_INDIRECT: 0.3, SOC_TRUST_BETRAYAL: -0.2,
      MEC_LUCK_SKILL: 0.5, MEC_COMPLEXITY: 0.2, MEC_STRATEGY: 0.5, MEC_ASYMMETRY: 0.4,
      AES_THEME_MECH: 0.0, AES_NARRATIVE: 0.0, AES_COMPONENT: 0.3,
      CTX_TIME: -0.2, CTX_NOSTALGIA: 0.0, CTX_PLAYER_COUNT: -0.85,
      EMO_TENSION: 0.4, EMO_HUMOR: 0.1,
    },
    confidence: uniformConfidence(0.8),
    expectations: {
      playingTimeRange: [20, 90],
    },
  },

  {
    id: 'solo-player',
    name: 'The Solo Player',
    narrative: 'Mostly plays alone. Loves puzzle-y solitaire-able games and campaigns. Mage Knight, Spirit Island, Robinson Crusoe. Doesn\'t care about social dimensions.',
    profile: {
      PSY_ACHIEVEMENT: 0.7, PSY_EXPLORATION: 0.7, PSY_SOCIAL: -0.85, PSY_KILLER: 0.0,
      PSY_OPENNESS: 0.6, PSY_CONSCIENTIOUSNESS: 0.6, PSY_EXTRAVERSION: -0.6,
      PSY_AGREEABLENESS: 0.0, PSY_NEUROTICISM: 0.0,
      SOC_COOP_COMP: -0.4, SOC_DIRECT_INDIRECT: -0.7, SOC_TRUST_BETRAYAL: -0.5,
      MEC_LUCK_SKILL: 0.5, MEC_COMPLEXITY: 0.7, MEC_STRATEGY: 0.7, MEC_ASYMMETRY: 0.3,
      AES_THEME_MECH: 0.4, AES_NARRATIVE: 0.6, AES_COMPONENT: 0.4,
      CTX_TIME: 0.5, CTX_NOSTALGIA: 0.0, CTX_PLAYER_COUNT: -1.0,
      EMO_TENSION: 0.4, EMO_HUMOR: -0.2,
    },
    confidence: uniformConfidence(0.85),
    expectations: {
      // Solo-friendly games span subdomains; assert via shouldNotMatch instead.
      shouldNotMatchSubdomains: ['Party'],
    },
  },

  {
    id: 'filler-enthusiast',
    name: 'The Filler-Game Enthusiast',
    narrative: 'Always has a 15-minute game ready between the heavy ones. No Thanks, Skull, Love Letter, Welcome To. Light, clever, replayable.',
    profile: {
      PSY_ACHIEVEMENT: 0.3, PSY_EXPLORATION: 0.3, PSY_SOCIAL: 0.5, PSY_KILLER: 0.0,
      PSY_OPENNESS: 0.4, PSY_CONSCIENTIOUSNESS: 0.0, PSY_EXTRAVERSION: 0.4,
      PSY_AGREEABLENESS: 0.3, PSY_NEUROTICISM: -0.2,
      SOC_COOP_COMP: 0.3, SOC_DIRECT_INDIRECT: 0.2, SOC_TRUST_BETRAYAL: 0.3,
      MEC_LUCK_SKILL: 0.0, MEC_COMPLEXITY: -0.7, MEC_STRATEGY: 0.0, MEC_ASYMMETRY: -0.3,
      AES_THEME_MECH: -0.3, AES_NARRATIVE: -0.5, AES_COMPONENT: -0.2,
      CTX_TIME: -0.85, CTX_NOSTALGIA: 0.0, CTX_PLAYER_COUNT: 0.3,
      EMO_TENSION: 0.3, EMO_HUMOR: 0.4,
    },
    confidence: uniformConfidence(0.85),
    expectations: {
      playingTimeRange: [10, 45],
      shouldNotMatchSubdomains: ['Wargame'],
    },
  },

  {
    id: 'trick-taker-traditionalist',
    name: 'The Trick-Taker Traditionalist',
    narrative: 'Spades, Bridge, Sheepshead, then The Crew. Wants skill-heavy partnership card games with deep tactical play. Hates "kid stuff."',
    profile: {
      PSY_ACHIEVEMENT: 0.6, PSY_EXPLORATION: -0.1, PSY_SOCIAL: 0.5, PSY_KILLER: 0.2,
      PSY_OPENNESS: -0.4, PSY_CONSCIENTIOUSNESS: 0.5, PSY_EXTRAVERSION: 0.3,
      PSY_AGREEABLENESS: 0.3, PSY_NEUROTICISM: -0.2,
      SOC_COOP_COMP: 0.3, SOC_DIRECT_INDIRECT: 0.4, SOC_TRUST_BETRAYAL: -0.1,
      MEC_LUCK_SKILL: 0.5, MEC_COMPLEXITY: 0.0, MEC_STRATEGY: 0.5, MEC_ASYMMETRY: -0.3,
      AES_THEME_MECH: -0.85, AES_NARRATIVE: -0.85, AES_COMPONENT: -0.4,
      CTX_TIME: -0.2, CTX_NOSTALGIA: 0.7, CTX_PLAYER_COUNT: 0.0,
      EMO_TENSION: 0.4, EMO_HUMOR: -0.1,
    },
    confidence: uniformConfidence(0.8),
    expectations: {
      shouldNotMatchSubdomains: ['Wargame', 'Children'],
    },
  },

  {
    id: 'roleplayer',
    name: 'The Roleplayer',
    narrative: 'Plays D&D weekly. Wants tabletop with high narrative + roleplay potential. Storytelling games, hidden roles, social deduction. Hates abstract.',
    profile: {
      PSY_ACHIEVEMENT: 0.0, PSY_EXPLORATION: 0.8, PSY_SOCIAL: 0.7, PSY_KILLER: 0.0,
      PSY_OPENNESS: 0.85, PSY_CONSCIENTIOUSNESS: -0.1, PSY_EXTRAVERSION: 0.5,
      PSY_AGREEABLENESS: 0.4, PSY_NEUROTICISM: 0.0,
      SOC_COOP_COMP: -0.3, SOC_DIRECT_INDIRECT: -0.2, SOC_TRUST_BETRAYAL: 0.6,
      MEC_LUCK_SKILL: -0.3, MEC_COMPLEXITY: 0.0, MEC_STRATEGY: -0.2, MEC_ASYMMETRY: 0.5,
      AES_THEME_MECH: 0.85, AES_NARRATIVE: 0.85, AES_COMPONENT: 0.4,
      CTX_TIME: 0.4, CTX_NOSTALGIA: 0.2, CTX_PLAYER_COUNT: 0.0,
      EMO_TENSION: 0.5, EMO_HUMOR: 0.4,
    },
    confidence: uniformConfidence(0.85),
    expectations: {
      shouldNotMatchSubdomains: ['Wargame', 'Children', 'Abstract'],
    },
  },

  {
    id: 'dexterity-fan',
    name: 'The Dexterity-Game Fan',
    narrative: 'Climbing 5 minutes every game-night. Crokinole, Flick \'em Up, Junk Art. Hands-on physical play, lots of laughter, low rules overhead.',
    profile: {
      PSY_ACHIEVEMENT: 0.3, PSY_EXPLORATION: 0.4, PSY_SOCIAL: 0.7, PSY_KILLER: 0.2,
      PSY_OPENNESS: 0.5, PSY_CONSCIENTIOUSNESS: 0.0, PSY_EXTRAVERSION: 0.6,
      PSY_AGREEABLENESS: 0.3, PSY_NEUROTICISM: -0.2,
      SOC_COOP_COMP: 0.2, SOC_DIRECT_INDIRECT: 0.4, SOC_TRUST_BETRAYAL: 0.0,
      MEC_LUCK_SKILL: 0.4, MEC_COMPLEXITY: -0.7, MEC_STRATEGY: -0.3, MEC_ASYMMETRY: -0.2,
      AES_THEME_MECH: 0.0, AES_NARRATIVE: -0.4, AES_COMPONENT: 0.6,
      CTX_TIME: -0.4, CTX_NOSTALGIA: 0.3, CTX_PLAYER_COUNT: 0.4,
      EMO_TENSION: 0.5, EMO_HUMOR: 0.7,
    },
    confidence: uniformConfidence(0.7),
    expectations: {
      shouldNotMatchSubdomains: ['Wargame', 'Children'],
    },
  },

  {
    id: 'lapsed-hobbyist',
    name: 'The Lapsed Hobbyist',
    narrative: 'Played a lot in their 20s. Now has kids and 2 hours on a Sunday morning if lucky. Wants something that feels rich but plays in 60 minutes — the elegant euro sweet spot.',
    profile: {
      PSY_ACHIEVEMENT: 0.5, PSY_EXPLORATION: 0.3, PSY_SOCIAL: 0.3, PSY_KILLER: -0.2,
      PSY_OPENNESS: 0.3, PSY_CONSCIENTIOUSNESS: 0.4, PSY_EXTRAVERSION: 0.0,
      PSY_AGREEABLENESS: 0.3, PSY_NEUROTICISM: -0.1,
      SOC_COOP_COMP: 0.3, SOC_DIRECT_INDIRECT: -0.5, SOC_TRUST_BETRAYAL: -0.4,
      MEC_LUCK_SKILL: 0.3, MEC_COMPLEXITY: 0.2, MEC_STRATEGY: 0.5, MEC_ASYMMETRY: 0.0,
      AES_THEME_MECH: -0.2, AES_NARRATIVE: -0.2, AES_COMPONENT: 0.3,
      CTX_TIME: -0.1, CTX_NOSTALGIA: 0.5, CTX_PLAYER_COUNT: -0.3,
      EMO_TENSION: 0.0, EMO_HUMOR: 0.0,
    },
    confidence: uniformConfidence(0.75),
    expectations: {
      subdomainOneOf: ['Family', 'Strategy'],
      playingTimeRange: [30, 90],
    },
  },

  {
    id: 'social-deduction-fanatic',
    name: 'The Social Deduction Fanatic',
    narrative: 'Lives for Werewolf, Avalon, Blood on the Clocktower. The lying IS the game. Will host a 12-player session at the drop of a hat.',
    profile: {
      PSY_ACHIEVEMENT: 0.2, PSY_EXPLORATION: 0.5, PSY_SOCIAL: 0.85, PSY_KILLER: 0.4,
      PSY_OPENNESS: 0.6, PSY_CONSCIENTIOUSNESS: -0.2, PSY_EXTRAVERSION: 0.85,
      PSY_AGREEABLENESS: -0.1, PSY_NEUROTICISM: 0.0,
      SOC_COOP_COMP: -0.2, SOC_DIRECT_INDIRECT: 0.5, SOC_TRUST_BETRAYAL: 0.95,
      MEC_LUCK_SKILL: 0.0, MEC_COMPLEXITY: -0.4, MEC_STRATEGY: 0.0, MEC_ASYMMETRY: 0.7,
      AES_THEME_MECH: 0.4, AES_NARRATIVE: 0.4, AES_COMPONENT: -0.2,
      CTX_TIME: 0.0, CTX_NOSTALGIA: 0.0, CTX_PLAYER_COUNT: 0.7,
      EMO_TENSION: 0.85, EMO_HUMOR: 0.5,
    },
    confidence: uniformConfidence(0.9),
    expectations: {
      shouldNotMatchSubdomains: ['Wargame', 'Children', 'Abstract'],
    },
  },

  {
    id: 'abstract-purist',
    name: 'The Abstract Purist',
    narrative: 'Go, Hive, Onitama, Tigris & Euphrates. Pure mechanics, no theme, perfect information preferred. Aesthetics matter; theme is a distraction.',
    profile: {
      PSY_ACHIEVEMENT: 0.7, PSY_EXPLORATION: 0.0, PSY_SOCIAL: 0.0, PSY_KILLER: 0.3,
      PSY_OPENNESS: 0.3, PSY_CONSCIENTIOUSNESS: 0.6, PSY_EXTRAVERSION: -0.4,
      PSY_AGREEABLENESS: 0.0, PSY_NEUROTICISM: -0.3,
      SOC_COOP_COMP: 0.6, SOC_DIRECT_INDIRECT: 0.4, SOC_TRUST_BETRAYAL: -0.4,
      MEC_LUCK_SKILL: 0.85, MEC_COMPLEXITY: 0.3, MEC_STRATEGY: 0.85, MEC_ASYMMETRY: -0.3,
      AES_THEME_MECH: -0.95, AES_NARRATIVE: -0.95, AES_COMPONENT: 0.3,
      CTX_TIME: 0.0, CTX_NOSTALGIA: 0.0, CTX_PLAYER_COUNT: -0.6,
      EMO_TENSION: 0.4, EMO_HUMOR: -0.5,
    },
    confidence: uniformConfidence(0.9),
    expectations: {
      subdomainOneOf: ['Abstract', 'Strategy'],
      shouldNotMatchSubdomains: ['Thematic', 'Party', 'Children'],
    },
  },

  {
    id: 'curious-newcomer',
    name: 'The Curious Newcomer',
    narrative: 'Played Catan once at a friend\'s house, liked it, wants to know what\'s next. Doesn\'t know what they don\'t like yet. Generally agreeable, open to anything.',
    profile: {
      PSY_ACHIEVEMENT: 0.2, PSY_EXPLORATION: 0.4, PSY_SOCIAL: 0.4, PSY_KILLER: -0.1,
      PSY_OPENNESS: 0.5, PSY_CONSCIENTIOUSNESS: 0.0, PSY_EXTRAVERSION: 0.2,
      PSY_AGREEABLENESS: 0.3, PSY_NEUROTICISM: 0.0,
      SOC_COOP_COMP: 0.0, SOC_DIRECT_INDIRECT: -0.2, SOC_TRUST_BETRAYAL: -0.1,
      MEC_LUCK_SKILL: 0.0, MEC_COMPLEXITY: -0.2, MEC_STRATEGY: 0.1, MEC_ASYMMETRY: 0.0,
      AES_THEME_MECH: 0.1, AES_NARRATIVE: 0.0, AES_COMPONENT: 0.2,
      CTX_TIME: -0.2, CTX_NOSTALGIA: 0.2, CTX_PLAYER_COUNT: 0.0,
      EMO_TENSION: 0.1, EMO_HUMOR: 0.2,
    },
    confidence: uniformConfidence(0.5),
    expectations: {
      // Newcomer gets a wide net — assert only that recs aren't extreme outliers.
      shouldNotMatchSubdomains: ['Wargame', 'Customizable'],
    },
  },

  // ----- Edge personas -----

  {
    id: 'edge-all-neutral',
    name: 'EDGE: All-Neutral Baseline',
    narrative: 'Every dim is 0. Tests the matcher\'s behavior when the player has no preferences — should NOT crash, should produce *something* even if the ranking is barely meaningful.',
    profile: Object.fromEntries(
      Object.keys(uniformConfidence(0)).map((k) => [k, 0]),
    ),
    confidence: uniformConfidence(0.5),
    expectations: {
      // No content assertions — this persona is purely a "doesn't crash" probe.
    },
  },

  {
    id: 'edge-extreme-positive',
    name: 'EDGE: Extreme High',
    narrative: 'Every dim is 0.95. Maximally chaotic / complex / competitive / asymmetric / themed. Stress-tests the matcher\'s behavior at the extremes.',
    profile: Object.fromEntries(
      Object.keys(uniformConfidence(0)).map((k) => [k, 0.95]),
    ),
    confidence: uniformConfidence(0.9),
    expectations: {
      // Probably trends Wargame / Customizable / Strategy. Loose assertion.
    },
  },

  {
    id: 'edge-extreme-negative',
    name: 'EDGE: Extreme Low',
    narrative: 'Every dim is -0.95. Maximally calm / abstract / cooperative / symmetric / un-themed. Inverse of the extreme high — should pull from the opposite corner.',
    profile: Object.fromEntries(
      Object.keys(uniformConfidence(0)).map((k) => [k, -0.95]),
    ),
    confidence: uniformConfidence(0.9),
    expectations: {},
  },
];

/**
 * Resolve persona id → DB player_id (with the test prefix applied).
 */
export function dbPlayerIdFor(persona) {
  return TEST_ID_PREFIX + persona.id;
}

export { TEST_ID_PREFIX };
