# Deploying Seidr's Quiz + Running Real-User Tests

Practical operational guide: how to deploy the quiz UI, recruit testers, receive their JSON exports, and turn those exports into recommendations you can read. Targeted at ~10–30 friendly testers as a Phase 0 calibration round.

For the broader engine context, see [`../README.md`](../README.md). For the constitutional rules of the silo, see [`../../SILO.md`](../../SILO.md).

---

## What you have today (state-of-the-world)

- **Deployable static quiz UI** at `seidr/quiz-ui/index.html` (~580 lines, embedded CSS + JS, mobile-first dark theme, #FF8200 accent, no auth, no DB, no backend)
- **18-question quiz** sampled from a curated 50-question bank covering 24 dimensions across 6 clusters (PSY/SOC/MEC/AES/CTX/EMO)
- **Profile JSON export** via Copy-to-clipboard or Download button at the end of the quiz
- **Offline matcher** (`scripts/run-rec.mjs`) that turns any quiz export into ranked recommendations against a 225-game corpus

The whole loop runs without a backend. You're going to share a URL, get JSONs back, and run the CLI on each.

---

## Step 1 — Deploy the quiz UI

Three options, in order of "easiest to set up" to "most production-grade":

### Option A: Vercel (recommended for first round)

```bash
# From rec-engines/seidr/quiz-ui/
npx vercel deploy --prod
# Follow prompts; pick "static" if asked
```

Result: a `https://seidr-quiz-<random>.vercel.app` URL you can share. Free tier; no auth needed; ships in ~30 seconds. Vercel will infer this is a static site.

### Option B: Netlify drop

```bash
# From rec-engines/seidr/quiz-ui/
# Open https://app.netlify.com/drop in a browser
# Drag the quiz-ui directory onto the page
```

Result: a `https://<random>.netlify.app` URL. Drag-and-drop UX; free tier.

### Option C: GitHub Pages

If the repo is public-readable (or you push `quiz-ui/` to a public branch):

```bash
# In your repo Settings → Pages, set source to the branch + /rec-engines/seidr/quiz-ui/
# Result URL: https://<user>.github.io/<repo>/rec-engines/seidr/quiz-ui/
```

Slower to update than Vercel/Netlify but free and ties to your repo lifecycle.

### Option D: Local serve (just you, no public URL)

```bash
cd rec-engines/seidr/quiz-ui && python -m http.server 8000
# Visit http://localhost:8000
```

Use this for self-testing the quiz before sharing.

---

## Step 2 — Sanity check the deployed quiz before sharing

Before sending a single tester the URL, take the quiz yourself once. You should see:

1. The intro screen with chaos-orange brand color and "Start" button
2. ~18 questions, each with 2-4 answer options
3. A progress bar that fills smoothly
4. A results screen with:
   - A 2-3 sentence narrative ("You lean toward strategic depth...")
   - 24 dimensional bars grouped by cluster
   - Three buttons: **Copy** (clipboard), **Download** (file), and the JSON in a `<pre>` block

**Verify the export works.** Click Copy → paste into a scratch file. The JSON should look like:

```json
{
  "meta": {
    "bank_version": "1.0.0",
    "questions_answered": 18,
    "timestamp": "2026-05-..."
  },
  "profile": {
    "PSY_ACHIEVEMENT": 0.5,
    ...
  },
  "confidence": {
    "PSY_ACHIEVEMENT": 1.0,
    ...
  },
  "raw": [
    { "question_id": "Q01", "question_type": "...", "answer_index": 0, "answer_text": "..." },
    ...
  ]
}
```

If anything's missing or malformed, fix BEFORE sharing — debug loops with real testers are exhausting.

---

## Step 3 — Recruit ~10–30 testers

You want **dimensional diversity**, not just random gamers. Aim for at least one person from each rough cluster:

| Tester archetype | What you're calibrating |
|---|---|
| Heavy-Euro player | Does the matcher rank Brass/TM/Gaia for them? |
| Casual family parent | Does the matcher avoid heavy wargames + recommend Wingspan-tier? |
| Party-game host | Does the matcher rank Codenames/BotC at the top? |
| Story / campaign player | Does the matcher rank Gloomhaven/Sleeping Gods? |
| Wargame nerd | Does the matcher rank TI4/WotR/Twilight Struggle? |
| Pure abstract / chess player | Does the matcher rank Hive/Onitama/Go? |
| Cooperative-only player | Does the matcher rank Pandemic Legacy / Spirit Island? |
| Newcomer / 5–10 owned games | Does the matcher produce sensible cold-start picks? |

Don't ship to 30 random people; ship to 10–15 across these clusters first, then iterate the question bank if needed before scaling.

### Recruitment template (adapt freely)

> Hey — I'm building a tabletop game recommender that uses an 18-question quiz instead of a big "rate every game" library. Five minutes of your time would help me calibrate it.
>
> 1. Take this quiz: <YOUR-DEPLOYED-URL>
> 2. At the end, hit "Download" — it'll save a tiny JSON file
> 3. Email/Discord/text it back to me
>
> Then I'll run it through the recommender and send you the top 10 recs it picked, plus a one-line explanation per game. You tell me which feel right and which feel weird.
>
> Nothing leaves your device until you send the file. No accounts, no signup, no email collection.

---

## Step 4 — Receive the JSON exports

The export is small (~5–8 KB per quiz). Receivable via:
- Email attachment
- Discord file upload
- Slack file upload
- Air-drop / signal / whatever

Save each to a single directory, e.g. `~/seidr-tester-exports/`:

```
~/seidr-tester-exports/
├── alex-2026-05-07.json
├── maya-2026-05-07.json
├── jordan-2026-05-08.json
└── ...
```

**Don't rename the files to lose context** — keep tester names + dates so you can correlate findings later.

---

## Step 5 — Generate recommendations for each tester

```bash
cd rec-engines/seidr

# Single tester
node scripts/run-rec.mjs \
  --player-profile ~/seidr-tester-exports/alex-2026-05-07.json \
  --game-profiles data/seed-game-profiles.json \
  --bgg-dir ../mimir/tests/fixtures/bgg \
  --limit 10 --detail rich \
  > ~/seidr-tester-results/alex-2026-05-07.txt
```

Or batch all testers:

```bash
mkdir -p ~/seidr-tester-results
for f in ~/seidr-tester-exports/*.json; do
  name=$(basename "$f" .json)
  node scripts/run-rec.mjs \
    --player-profile "$f" \
    --game-profiles data/seed-game-profiles.json \
    --bgg-dir ../mimir/tests/fixtures/bgg \
    --limit 10 --detail rich \
    > ~/seidr-tester-results/$name.txt
done
```

Each result file looks like:

```
=== Seidr Recommendations ===
Player: quiz UI export (18 questions answered, bank v1.0.0)

1. Brass: Birmingham [BGG 224517]   score=0.94
   Strong match for Brass: Birmingham on MEC_STRATEGY + PSY_CONSCIENTIOUSNESS (cosine 0.94).

2. Gaia Project [BGG 220308]        score=0.93
   ...
```

---

## Step 6 — What to look for in tester feedback

Send each tester their top 10 recs and ask **three specific questions**:

1. **Did any of the top 3 feel obviously wrong?** ("This is a 4-hour wargame and I hate wargames")
2. **Did any of the top 10 surprise you in a good way?** ("I've never heard of this but it sounds perfect")
3. **What's missing?** ("I expected to see X in the top 10 and it's not there")

What you're calibrating:

- **Question bank quality** — if the same question keeps producing weird answers across testers, it's a candidate to cut/rewrite
- **Reference profile accuracy** — if testers consistently say "X shouldn't have ranked that high for me," it might be that X's profile in the seed corpus is miscalibrated
- **Coverage gaps** — if testers expect games not in the 225-game seed corpus, those are candidates to add via the LLM-API run

### Diagnostic tools when feedback is weird

When a tester says "why did you recommend X for me?":

```bash
# Show the full ranking with explanations grounded in the player's dimensions
node scripts/run-rec.mjs --player-profile <their-export.json> \
  --game-profiles data/seed-game-profiles.json --limit 50 --detail rich
```

When a tester says "X shouldn't be near Y in the corpus":

```bash
# Show which games are dimensionally near X
node scripts/find-similar.mjs <x-bgg-id> --bgg-dir ../mimir/tests/fixtures/bgg --limit 10
```

When you suspect the corpus has drifted (e.g., after re-generating profiles via API):

```bash
node scripts/profile-diff.mjs \
  --from data/seed-game-profiles.json \
  --to /path/to/new-profiles.json \
  --top 30
```

---

## Step 7 — What to commit back to the repo

After a round of testing, you'll likely want to:

1. **Iterate the question bank** (`data/question-bank.json`) — cut weak questions, rewrite ambiguous ones, add new ones to fill coverage gaps
2. **Refine reference profiles** (`data/reference-profiles.json`) — adjust dim values for games where multiple testers said "this profile feels off"
3. **Extend the seed corpus** (`data/seed-game-profiles.json`) — add games multiple testers wanted but weren't in the 225

Each of these is a sprint. Sprint discipline applies (pre-flight, build, verify, push, post-mortem). The seed corpus and consistency tests will tell you whether your refinements break anything.

---

## Privacy posture (worth being explicit about)

- **The quiz UI does not phone home.** Everything runs in the browser; the JSON is yours and yours alone unless you choose to send it.
- **The CLI runs on your machine.** No data leaves your laptop unless you choose to share results back to the tester.
- **You will be storing testers' JSONs.** Treat them like contact info — don't post them publicly, don't share without consent, don't keep them longer than the calibration round needs.
- **You may want to delete tester exports after calibration is done.** Or archive them in a private bucket. Don't let them rot in your downloads folder.

If you do this professionally later (e.g., FLGS owners running it for their store), you'll want a more formal consent flow. For Phase 0 friendly-tester rounds, an honest informal recruitment message is sufficient.

---

## Failure modes you might hit and how to debug

**Quiz UI shows blank screen.** Check the browser console for fetch errors. The UI tries to load `./question-bank.json` and `./dimensions.json` — both must be in the same directory as `index.html` on the deployed host.

**Quiz UI 404s on `question-bank.json`.** Vercel/Netlify/GitHub Pages require static files relative to the deployment root. If you deployed the entire repo, the path may need adjustment. Easiest fix: deploy ONLY the `quiz-ui/` directory (which has its own copies of `question-bank.json` and `dimensions.json`).

**`run-rec.mjs` complains about player-profile shape.** The loader auto-detects 4 shapes (quiz UI export, matcher-native, etc.); if it still fails, run `node scripts/run-rec.mjs --player-profile <theirs.json> 2>&1 | head -3` to see the actual error. Most common cause: the tester pasted into a Slack message and Slack added smart-quotes. Have them send via Download button + file attachment, not paste.

**Tester says "I got the same top 10 as my friend."** This is real signal: either (a) the matcher isn't differentiating enough on subtle profile differences, or (b) the quiz isn't probing deep enough. Look at their two `dim_vector`s side-by-side — if they're very similar, that's the quiz's fault; if they're different but the rankings are similar, that's the matcher's fault. The corpus consistency tests at `tests/corpus-consistency.test.mjs` won't catch this; you'd need a "diversity-of-recs across diverse-players" assertion that doesn't exist yet.

**A tester reports a recommendation that no one else got.** Use `find-similar.mjs <recommended_bgg_id>` to see if that game's neighborhood in the corpus makes sense. If the game's profile is anchoring it in a weird region, that profile may need refinement.

---

## After 10 testers — what success looks like

At the end of a 10-tester round you should have:

- 10 result files (one per tester)
- Per-tester feedback on top-3 wrongness, top-10 surprises, and missing games
- A list of question bank candidates to revise (typically 2–4 of the 50)
- A list of corpus games whose profiles need refinement (typically 5–15 of the 225)
- A list of new games to consider adding to the corpus (typically 10–30)

That's the input to your next sprint cycle. Repeat as needed; each round should produce diminishing-returns feedback. After 30 testers across a few cycles, the offline loop is calibrated and you can confidently propose graduation to a wider audience or to the production rec router.
