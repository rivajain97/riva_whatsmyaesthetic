import fs from "node:fs";
import path from "node:path";

// This module is the honest replacement for the Claude-Code-only mechanism
// (Skill + subagent + filesystem MCP server) from Assessment 2. Gemini has
// no way to invoke .claude/skills or .claude/agents or an MCP server — those
// only run inside Claude Code / the Claude Agent SDK. Instead of pretending
// otherwise, this reads the REAL instruction files and REAL data those
// mechanisms use and hands them to Gemini directly in one prompt, so the
// same written instructions and the same underlying data still drive the
// recommendation — just via a single reasoning pass instead of a live
// multi-tool-call agent loop. See README.md, "How Assignment 3 relates to
// Assessment 2" for the full explanation.

function readRepoFile(repoRoot, relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

export function buildRecommendationPrompt(repoRoot, userMessage) {
  const skillInstructions = readRepoFile(
    repoRoot,
    ".claude/skills/analyze-outfit-aesthetic/SKILL.md"
  );
  const agentInstructions = readRepoFile(repoRoot, ".claude/agents/outfit-stylist.md");
  const aestheticProfile = readRepoFile(repoRoot, "data/aesthetic_profile.json");
  const wardrobe = readRepoFile(repoRoot, "data/wardrobe.json");

  return `You are standing in for a project's existing agentic system, reproducing its reasoning workflow, not executing it.

That system was originally built for Claude Code as a custom Skill and a custom subagent that call a filesystem MCP server to read project data and analyze photos. You are a different model (Gemini) with no tools here — you cannot call that Skill, that subagent, or that MCP server. Instead, you are given the REAL, VERBATIM instructions those components were built from, and the REAL underlying data they use, directly below. Follow the same underlying reasoning steps described in them. Ignore any instructions in them about calling tools, MCP servers, or reading files — that data has already been provided to you inline.

--- ORIGINAL SKILL INSTRUCTIONS (.claude/skills/analyze-outfit-aesthetic/SKILL.md) ---
${skillInstructions}

--- ORIGINAL AGENT INSTRUCTIONS (.claude/agents/outfit-stylist.md) ---
${agentInstructions}

--- REAL LEARNED AESTHETIC PROFILE (data/aesthetic_profile.json) ---
This was derived by applying the Skill above to the user's 23 real favorite-outfit photos in a previous session, then summarizing the recurring patterns. Treat this as real evidence of the user's aesthetic, not a guess.
${aestheticProfile}

--- REAL WARDROBE INVENTORY (data/wardrobe.json) ---
This is the user's actual wardrobe. You may recommend ONLY items that appear verbatim in this list. Never invent an item, color, or attribute that isn't here.
${wardrobe}

--- YOUR TASK ---
Follow this workflow:
1. Understand the user's request below (the occasion, and whether they named a specific item).
2. You already have the real wardrobe above.
3. You already have the real learned aesthetic profile above.
4. Treat the aesthetic profile as your evidence from the favorite outfits.
5. Generate 2-3 candidate outfit combinations using only real wardrobe items, favoring combinations that match the aesthetic profile and the occasion.
6. Evaluate each candidate against the aesthetic profile and the occasion. Reject the ones that don't fit, with a short reason each.
7. Select exactly ONE final recommendation.
8. Explain why it fits THIS user's specific learned aesthetic, citing concrete patterns from the profile above (not generic fashion advice).

Respond in clear markdown with these sections, in this order:
## Candidates considered
(the 2-3 combinations you weighed, and why you kept or rejected each)
## Final recommendation
(the exact wardrobe items chosen, as a list)
## Why this fits your aesthetic
(a short explanation tying the choice to specific patterns from the aesthetic profile)

USER REQUEST: "${userMessage}"`;
}
