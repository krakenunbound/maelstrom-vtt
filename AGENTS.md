# Notes for coding agents

Maelstrom VTT's notes for agents are in [AGENT.md](AGENT.md) and [CLAUDE.md](CLAUDE.md).

## Converting a PDF into a .kpack

Use the skill [skills/pdf-to-kpack/SKILL.md](skills/pdf-to-kpack/SKILL.md). It is the only procedure for it.
A conversion is done only when `npm run kpack:verify` prints `DONE`. If the book's game is not one Maelstrom
plays, stop and ask the user.

## Making a dice pack

Use the skill [skills/dice-set/SKILL.md](skills/dice-set/SKILL.md). It is the only procedure for it. A dice pack is
one `.kpack` file, made and checked by the skill's `dice_pack.py`.
