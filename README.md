# What's My Aesthetic?

A small web app that learns your personal aesthetic from your favorite outfit
photos, then recommends what to wear from your *actual* wardrobe — not
generic fashion advice.

Ask it something like *"What should I wear to dinner with friends?"* and it
answers with real items from your closet, explaining exactly which of your
favorite-outfit patterns each choice matches.

## What the MVP does

1. You type a request into the web UI (an occasion, an item you want to
   build around, whatever).
2. The backend grounds that request in two real, pre-built datasets:
   - `data/wardrobe.json` — your actual clothing inventory.
   - `data/aesthetic_profile.json` — the recurring aesthetic patterns
     (silhouette, color palette, jewelry, visual density, etc.) found by
     analyzing 23 of your real favorite-outfit photos in
     `data/favorite_outfits/`.
3. It sends that grounded context to an AI model (Gemini), which reasons
   through 2–3 candidate outfits, evaluates them against your learned
   aesthetic, and picks one.
4. The UI shows the final recommendation, which candidates were rejected
   and why, and an explanation tying the pick back to specific patterns
   from your favorite outfits.

No account system, no database, no image generation — a single request/response
flow, on purpose (see **What's intentionally left for later**, below).

## Architecture

```
USER
 ↓
WEB UI (app/public — static HTML/CSS/JS)
 ↓
LOCAL BACKEND (app/server.js — Express)
 ↓
AI PROVIDER INTERFACE (app/providers — provider-independent)
 ↓
GEMINI PROVIDER (app/providers/GeminiProvider.js, for this MVP)
 ↓
Gemini API
 ↓
PERSONALISED RECOMMENDATION
 ↓
UI
```

The backend never talks to Gemini (or any model) directly — every request
goes through `app/providers/index.js`, which picks the provider named by the
`AI_PROVIDER` environment variable and calls its `generateRecommendation(prompt)`
function. Right now only `gemini` is implemented (`app/providers/GeminiProvider.js`),
but the UI and the recommendation logic (`app/lib/buildPrompt.js`) don't know
or care which provider is behind that interface — adding a second provider
later means adding one more file that implements the same function, nothing
else changes.

### How this relates to the Assessment 2 Skill/Agent/MCP work

Assessment 2 built a real agentic slice **inside Claude Code**: a custom
Skill (`.claude/skills/analyze-outfit-aesthetic/SKILL.md`), a custom
subagent (`.claude/agents/outfit-stylist.md`) running a genuine
perceive→reason→act→observe loop, and a filesystem MCP server
(`.mcp.json`) the agent called to read the wardrobe and photos. All of
those files are still in this repo, **unmodified** — they're the original,
real agentic implementation, and `data/aesthetic_profile.json` (the learned
aesthetic used by this app) is literally the output of running that Skill
against all 23 real favorite-outfit photos.

**Honest limitation:** those `.claude/` files and `.mcp.json` only run
inside Claude Code (or the Claude Agent SDK, which needs an Anthropic API
key). Gemini cannot execute them — there is no version of Gemini that reads
`.claude/skills` or calls an MCP server. This app does **not** claim
otherwise. Instead, `app/lib/buildPrompt.js` reads the real, verbatim text
of `SKILL.md` and `outfit-stylist.md`, plus the real `wardrobe.json` and
`aesthetic_profile.json`, and hands all of it to Gemini directly in one
prompt, instructing it to follow the same underlying reasoning steps (not
the tool-calling mechanics, which don't apply here) using the same real
data. So the same written instructions and the same real data still drive
every recommendation — just via one Gemini reasoning pass instead of the
original live, multi-tool-call Claude Code agent loop.

An earlier version of this app used the Claude Agent SDK directly (which
*can* run `.claude/` config programmatically) instead of this
provider-abstracted approach. It was replaced because it required an
Anthropic API key and Claude infrastructure specifically, which conflicted
with the goal of a provider-independent standalone app the user could run
with a key from any supported AI provider — Gemini, for this MVP.

## Install & run

Requires [Node.js](https://nodejs.org/) 20+ and a free
[Gemini API key](https://aistudio.google.com/apikey).

```bash
cd app
npm install
cp .env.example .env
```

Open `app/.env` and add your key:

```
AI_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
```

Then start it:

```bash
npm start
```

Open **http://localhost:3000** and ask it something.

A recommendation takes roughly 5–20 seconds (it's reasoning over your real
data, not returning a canned answer), and Gemini's shared capacity
occasionally returns a transient "high demand" error — the backend already
retries that automatically once before giving up.

## Using it

Type a request and press **Ask** (or Enter). Examples:

- "What should I wear to the mall?"
- "What should I wear to dinner with friends?"
- "What should I wear with my brown tank top?"
- "I need an outfit for a casual date."

The response always uses only real items from `data/wardrobe.json` and
explains its reasoning against your real aesthetic profile.

## What the current MVP includes

- A provider-independent AI layer (`app/providers/`) with one real
  implementation (Gemini).
- Recommendations grounded in real wardrobe data, a real learned aesthetic
  profile, and the real Assessment 2 Skill/agent instructions.
- A clean, editorial single-page UI matching the visual direction (warm
  cream background, serif display heading, cyan accents, pill input).
- Graceful handling of: empty input, a missing API key, an invalid API key,
  a Gemini API failure (including one automatic retry on transient "high
  demand" errors), and an empty/unreadable model response — none of these
  crash the app or show a raw stack trace.

## What's intentionally left for later

These were explicitly out of scope for this MVP, not overlooked:

- User accounts, authentication, or multi-user support.
- A database (all data is static JSON/image files in `data/`).
- Additional AI providers beyond Gemini (the abstraction supports adding
  one, but only Gemini is implemented).
- AI-generated outfit images, virtual try-on, or avatars.
- Editing the wardrobe or re-analyzing favorite photos from the UI (both
  still require editing the JSON files or re-running the Assessment 2
  Skill inside Claude Code).
- Any UI animation beyond a simple loading state.

## Project structure

```
.claude/skills/analyze-outfit-aesthetic/SKILL.md   Assessment 2 Skill (unmodified, reused as data)
.claude/agents/outfit-stylist.md                   Assessment 2 agent (unmodified, reused as data)
.mcp.json                                          Assessment 2 MCP config (unmodified, not used by this app)
data/wardrobe.json                                 real wardrobe inventory
data/aesthetic_profile.json                        real learned aesthetic profile
data/favorite_outfits/                             23 real favorite-outfit photos + per-photo analysis
app/server.js                                      Express server, one route: POST /api/recommend
app/providers/                                      the AI provider interface + GeminiProvider
app/lib/buildPrompt.js                              grounds every request in the real data above
app/public/                                         the static UI (HTML/CSS/JS, no framework)
```
