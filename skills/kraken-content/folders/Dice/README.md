<!-- kraken-vtt guide: Maelstrom writes this file and keeps it up to date. Edit a copy, not this one. -->
# Dice packs

Drop a **dice pack**, a `.kpack` file, in this folder to add dice sets to
Maelstrom. Every seat at your table can then choose them: you, and your
players in their browsers. They appear in the **Dice** window as a group named
after the pack. To share a pack, send the `.kpack` file.

Maelstrom reads this folder when a table is hosted: to see a new pack, leave
the table and host it again.

**To make a pack**, show your AI agent **`DICE-SET-SKILL.md`** (in this folder)
and describe the dice you want. That file is the whole procedure; its tool,
`dice_pack.py`, is beside it.

`Kraken Sea Glass.kpack` came with this folder as an example.

Older dice packs made as a folder (or a `.zip`) with a `dice.json` are still
read. A `.kpack` of the same name wins over one.
