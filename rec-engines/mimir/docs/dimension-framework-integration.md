# Dimension Framework Integration

> **Source research:** Manus AI synthesis, "The Tabletop Recommendation Graph: A Multi-Dimensional Framework for Board Game and Player Similarity" (2026-05-06). 24-page document covering five dimensional clusters + graph architecture, grounded in psychology, sociology, game theory, and design literature.
>
> **This doc:** how Manus's framework integrates with Mimir's existing schema and what it enables across the engine roadmap (mimir, huginn, muninn, saga, norns).

## TL;DR

Manus’s research arrives at architectural conclusions very close to ours, with some net-new dimensions worth pulling in. Sprint 1.0.15 adds four new node types to the schema (`rec_personality_profile`, `rec_emotion`, `rec_cognitive_profile`, `rec_context_type`) without changing any existing tables or behavior. The new tables are additive forward-compatibility; population happens later when the player questionnaire (separate Manus workstream) ships.

## Where the framework aligns with what we already have

| Manus dimension | Existing in our schema |
|---|---|
| Game, Player, Group, Mechanic, Theme, Designer nodes | `rec_game`, `rec_player`, `rec_group`, `rec_mechanic`, `rec_theme`, `rec_designer` |
| Has_Mechanic, Has_Theme, Designed_By, Played_Game edges | `rec_edge` with appropriate `edge_type` values |
| Loves_Mechanic edge (player preference) | `seed-loved` / `voted-love` edges in `rec_edge` |
| Group recommendation problem | saga’s soft-min aggregator (= Manus’s “least misery” strategy) |
| Context-as-dimension (the key thesis) | already in the `recommend(request.context)` shape; ephemeral request-time |
| Cooperative-competition spectrum | encoded via mechanic edges (cooperative-game, team-based-game, etc.) |
| Mechanical / experiential / contextual / psychographic similarity | exists implicitly in mimir’s scoring function |

The existing `rec_edge` table already supports `(src_type, dst_type, edge_type)` for any pair of node types, so adding new node types doesn’t require any change to the edge schema.

## What’s net-new (added in Sprint 1.0.15)

Four new node tables. Each is a target for edges from `rec_player` and `rec_game`. Edges go through the existing `rec_edge` table.

### `rec_personality_profile`

Archetype/trait nodes. Frameworks: Bartle (Achiever/Explorer/Socializer/Killer), Big Five OCEAN (Openness/Conscientiousness/Extraversion/Agreeableness/Neuroticism), SDT (Competence/Autonomy/Relatedness), Yee motivational clusters (Action/Social/Mastery/Achievement/Immersion/Creativity).

**Player edges:** `(player, personality_profile, edge_type='ocean_score', weight=0.7, context={'framework':'ocean','trait':'openness'})`. One edge per (player, trait) for each framework the player has been profiled on.

**Game edges:** `(game, personality_profile, edge_type='affords_archetype', weight=0.8)` representing affinity — i.e. "this game suits high-Openness players."

**Population:** Populated by the questionnaire workstream (separate Manus output, plus subsequent inference from play/vote/trade signal). Empty at launch.

### `rec_emotion`

Emotional categories. Sources: MDA aesthetics (Hunicke et al., 2004 — Sensation/Fantasy/Narrative/Challenge/Fellowship/Discovery/Expression/Submission) plus emotional palette (Tension, Humor, Triumph, Wonder, Nostalgia, Catharsis).

**Game edges:** `(game, emotion, edge_type='induces_emotion', weight=intensity)` — a game can induce multiple emotions with varying intensities.

**Player edges:** `(player, emotion, edge_type='prefers_emotion', weight=preference)` — a player can prefer multiple emotions.

**Why distinct from theme/mechanic:** Theme is content ("this game is about space"). Mechanic is structure ("this game has worker placement"). Emotion is the experiential outcome ("this game makes me feel tension"). A horror-themed game and a sci-fi-themed game can both induce dread; a worker-placement game and a deck-builder can both induce flow. Emotion is the cleaner signal for matching what a player actually wants tonight.

**Population:** Initial seed list after questionnaire design lands (~15 emotions covering MDA + palette). Game-emotion edges populated by curation + inference from recap notes (Sprint 1.0.13 spec).

### `rec_cognitive_profile`

Cognitive accessibility dimensions. Per Manus § 1.4: working memory load, attention span, processing speed, spatial reasoning, verbal/linguistic ability, social cognition. Six core dimensions, each a row.

**Player edges:** `(player, cognitive_profile, edge_type='cognitive_capacity', weight=capacity)` representing the player’s comfort/capacity on that dimension. Optionally captured via questionnaire opt-in. Critical for accessibility and Credo-aligned inclusion.

**Game edges:** `(game, cognitive_profile, edge_type='requires_cognitive', weight=load)` representing the game’s requirement on that dimension. "This game requires high working memory."

**Population:** 6 seed rows for the dimensions; game requirements seeded via curation (BGG community already tags some of this; the rest from playtesting + recap signal).

### `rec_context_type`

Recurring named contexts. Not the per-request context object (which is ephemeral and lives only in `recommend(request.context)`); these are reusable named patterns. Examples: `party_8p_45min`, `family_night`, `couples`, `hobby_group`, `educational`, `convention`, `cafe_pickup`.

**Game edges:** `(game, context_type, edge_type='optimal_for_context', weight=fit_score)` — a game that’s great as a 4-player family night gets a strong edge there.

**No player edges by default** — a player’s "preferred context" is captured per-group / per-ritual, not per-individual.

**Population:** Initial seed list of ~10 named contexts after curation; game-context edges via inference from played-at-night data + curation.

## What this enables across engines

### Mimir (foundation)

No behavior change. The new node types exist; mimir’s scoring function doesn’t consume them yet. Forward-compatible: when the questionnaire ships, mimir’s scorer can optionally weight edges to personality/emotion/cognitive nodes as additional features. Implemented as a v0.2 ranker variant; existing v0.1 unaffected.

### Huginn (PPR)

Directly benefits. PPR runs over the `rec_edge` graph; new edges (player→personality, game→emotion, etc.) propagate naturally during random walk. A high-Openness player’s PPR vector flows through the personality_profile nodes to games that score high on Openness affinity, even without direct play history. **Solves the cold-start problem for huginn.**

### Muninn (embeddings, future)

The four new node types become explicit factors in the embedding space. Where today’s embeddings would be opaque latent features, named dimensions like `m-engine`, `c-strategy`, `personality:ocean_openness`, `emotion:tension` become labeled axes. The embedding space is interpretable by construction.

### Saga (the breakthrough simulator, future)

This is where the new dimensions matter most. Saga’s per-player fun model trains on recap data (Sprint 1.0.13 spec); without personality features, that model is feature-poor and slow to converge. **With personality + cognitive + emotion priors from the questionnaire, saga can generate useful recommendations months earlier than the recap-data-only timeline.** This is potentially the single largest acceleration for the breakthrough engine.

Specifically: the per-player fun model takes (player_features, game_features, context_features) → P(fun). With the new schema, player_features now include OCEAN scores, motivation profile, emotion preferences, cognitive comfort. Game_features include emotion induction, cognitive load, context fit. Saga’s feature space tripled in richness for the cost of one schema migration.

### Norns (gene-graph, distant future)

The seed gene pool is now informed by Manus’s named taxonomy rather than purely emergent. Hybrid: norns starts with personality + emotion + cognitive + context as seed dimensions, then speciation refines. Better than pure-emergent (faster cold start) and better than pure-named (still discovers novel axes).

## Questionnaire integration

Manus is in parallel developing a "this vs that" questionnaire to baseline player models. The output of that questionnaire writes to:

| Question type | Edge it produces |
|---|---|
| Game-vs-game forced choice | `seed-loved` / `seed-noped` edges to existing `rec_game` |
| Mechanic-vs-mechanic | edges to `rec_mechanic` with `voted-love` / `voted-nope` |
| "Lose dramatically vs win boringly?" | edges to `rec_personality_profile` (e.g. SDT/Bartle scoring) |
| "Tension or laughter?" | edges to `rec_emotion` |
| "How’s your headspace tonight?" | edges to `rec_cognitive_profile` |
| "Party night vs hobby night?" | edges to `rec_context_type` |

Design principles for the questionnaire (passed to Manus when relevant):

1. **≤15 questions max** for first-time onboarding. 50-item OCEAN inventory is a capture-killer.
2. **Multi-signal questions are gold** — a single question should pay for itself across multiple dimensions.
3. **Game-vs-game questions are the most direct signal** — use a curated grid (we have a pool from Sprint 1.0.1).
4. **Make it a quiz, not a survey.** Image cards, fun copy, gamified.
5. **Output confidence is low at start** — weight questionnaire-derived edges lower than play-derived edges in scoring. The rec engine should know "this is from a 30-second quiz" vs "this is from 6 months of plays."

## What’s explicitly NOT being absorbed

- **Biometric / physiological dimensions** (heart rate, skin conductance, facial expression analysis). Surveillance-shaped. Credo violation. Out of scope, period.
- **Cognitive load profiling over time** as moment-to-moment inference. Requires longitudinal data we won’t have for years; aspirational not Phase 1.
- **Inferred moral/ethical resonance.** Better as opt-in player flags than inferred state.
- **Inferred OCEAN from play patterns** without explicit consent. Possible to do; not a default. Players who opt in to deeper personality profiling get richer recs; players who don’t get standard recs.

## Versioning / open questions

- **Seed taxonomies** for personality archetypes, emotions, cognitive dimensions, context types: not committed in 0002 (schema-only). Will land in a separate seed migration once Manus’s questionnaire output stabilizes.
- **Questionnaire → edge mapping is design-only** until Manus’s questionnaire spec lands. The mapping above is a recommendation, not a contract.
- **Edge weight calibration**: the absolute scale of weights from questionnaire-derived edges vs play-derived edges needs empirical tuning once data exists. Best guess: questionnaire edges weighted 0.3–0.5x play edges; refined via offline eval.

## Cross-reference

- Mimir architectural design doc — for the architectural vocabulary
- `recap-data-spec.md` (Sprint 1.0.13) — for the recap fields that feed saga’s training
- Manus PDF — for the full taxonomic justification
- Sprint 1.0.15 SPRINT_LOG entry — for migration validation evidence
