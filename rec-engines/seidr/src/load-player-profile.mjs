// load-player-profile.mjs
// ============================================================================
// Pure function: normalize a player profile from any of the formats this
// engine produces or accepts into the canonical { dim_vector, confidence_vector }
// shape that match() and explain() consume.
//
// Why this module exists:
//   The quiz UI (seidr/quiz-ui/index.html) exports player profiles with
//   keys named `profile` and `confidence`. The matcher expects
//   `dim_vector` and `confidence_vector`. Without normalization, dropping
//   a quiz export into match() silently produces empty results
//   (no key intersection -> cosine 0). This module is the canonical
//   translation surface.
//
// Accepted input shapes (auto-detected):
//   1. Quiz UI export:
//        { meta?, profile: {DIM: number}, confidence: {DIM: number}, raw?: [...] }
//   2. Matcher-native:
//        { dim_vector: {...}, confidence_vector: {...} }
//   3. Game-profile-style (alt name):
//        { dim_vector: {...}, confidence_per_dim: {...} }
//   4. Reference-profiles entry:
//        { game_id, dim_vector, confidence_per_dim, narrative? }
//        (when treating a game profile as a "player" for testing)
//
// Output shape:
//   { dim_vector: {...}, confidence_vector: {...}, _meta: {...} }
//
// _meta carries provenance for diagnostics (where the profile came from,
// quiz bank version, question count) but doesn't affect matching.
// ============================================================================

/**
 * Detect the input shape and return a canonical profile.
 *
 * @param {object} input  - one of the accepted shapes
 * @returns {{ dim_vector: object, confidence_vector: object, _meta: object }}
 * @throws if no recognizable shape is detected
 */
export function normalizePlayerProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('normalizePlayerProfile: input must be an object');
  }

  const meta = {};

  // Shape 1: quiz UI export. `profile` + `confidence` (and a `meta` block, optional)
  if (isPlainObject(input.profile) && isPlainObject(input.confidence)) {
    if (input.meta) {
      meta.source = 'quiz_ui_export';
      meta.bank_version = input.meta.bank_version ?? null;
      meta.questions_answered = input.meta.questions_answered ?? null;
      meta.timestamp = input.meta.timestamp ?? null;
    } else {
      meta.source = 'profile_confidence_pair';
    }
    return {
      dim_vector: { ...input.profile },
      confidence_vector: { ...input.confidence },
      _meta: meta,
    };
  }

  // Shape 2: matcher-native. `dim_vector` + `confidence_vector`
  if (isPlainObject(input.dim_vector) && isPlainObject(input.confidence_vector)) {
    meta.source = 'matcher_native';
    return {
      dim_vector: { ...input.dim_vector },
      confidence_vector: { ...input.confidence_vector },
      _meta: meta,
    };
  }

  // Shape 3 + 4: game-profile-style alt confidence key
  if (isPlainObject(input.dim_vector) && isPlainObject(input.confidence_per_dim)) {
    meta.source = input.game_id != null ? 'game_profile_as_player' : 'profile_with_alt_conf_key';
    if (input.game_id != null) meta.original_game_id = input.game_id;
    return {
      dim_vector: { ...input.dim_vector },
      confidence_vector: { ...input.confidence_per_dim },
      _meta: meta,
    };
  }

  // No recognizable shape
  throw new Error(
    'normalizePlayerProfile: input does not match any known profile shape. ' +
      'Expected one of: { profile, confidence } (quiz UI export); ' +
      '{ dim_vector, confidence_vector } (matcher-native); ' +
      '{ dim_vector, confidence_per_dim } (game-profile shape).'
  );
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Optional: when the canonical profile is built, copy a human-readable
 * label string in if the input had one (or if a default should be applied).
 */
export function withLabel(profile, label) {
  return { ...profile, label };
}
