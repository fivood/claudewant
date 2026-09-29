# A Visitor from the Fourth Dimension

English · [中文](README.md)

A four-dimensional creature (Clawd) falls into an endlessly unfolding two-dimensional world and starts from a blank sheet. A pixel idle game; there's nothing you have to do.

- **Web**: https://claude.70015.net. Once opened online, it keeps working offline. On e-ink browsers such as the Kindle's it switches to e-ink mode (redraws every 3 seconds, daytime only, compact windows); `?eink=1` / `?eink=0` turns it on or off by hand.
- **Desktop (pet)**: download `SiweiLaike_*_x64-setup.exe` from [Releases](https://github.com/fivood/claudewant/releases/latest). Clawd lives on top of your taskbar, pacing back and forth and talking. Click it to open the full game; close the window and it shrinks back. Updates itself.
- **Session viewer**: https://claude.70015.net/viewer turns AI coding-assistant session logs into readable conversations.

## How it plays

- Wherever Clawd walks, the paper unfolds. Unfolded tiles become *perception*, and Clawd decides what to grow next on its own.
- **A session as the seed**: at the start you can import a session log (Claude Code, Codex, Kimi Code or Antigravity logs, a claude.ai / ChatGPT data export, or OpenAI-style messages). The conversation becomes the paper: lots of file reading pools into water, commands push up mountains, edits grow forests, errors stay behind as rifts, and the residents recite things you said. The file is read locally and never uploaded. The *tips* button in the import dialog lists where each tool keeps its logs.
- **The conversation road and session wonders**: the conversation is drawn as a curve in four dimensions, and its shadow on the paper is a road. Along the road stand pixel-art 3D objects grown from the conversation (an opening stele, the most-edited files, the errors, deploys and builds...), with shadows that follow the sun where you are. Clawd remembers things it said and thought during that conversation.
- **Terrain** is picked by the seed: Earthlike, Dual-Vector Foil, Dune, Solaris, Crystallized, Circuit Board, Ink Wash, Blueprint, Tissue Slide. Some of them move: Earthlike has relief shading lit from the top left, with cloud shadows drifting over it and the water glinting; wind blows sand across the Dune while sandworms swim underneath, the big ones surfacing halfway; the Circuit Board is drawn like a real board (chips, resistors and capacitors, crystals, connectors, copper pours with vias, silkscreen labels), data packets run along the traces and flash on the pads, and where Clawd passes it sometimes shorts things out with sparks, smoke and scorch marks; the Dual-Vector Foil is painted in swirling Van Gogh brushstrokes, flattened planets lie open as rings of core, mantle, crust, ocean and air, houses are unfolded cube nets, and aftershock rings of flattening sweep across it; the Solaris ocean breathes and sometimes ripples around Clawd, watching it; the Crystallized ground is tiled seamlessly with crystals of each mineral's own habit, glowing along their outlines in their own way while a patch of light drifts between them; the Ink Wash is one whole painting pieced together from small scenes (odd peaks, waterfall cliffs, willow villages by the river, pines, mountain temples...), its waterfalls pouring and river ripples drifting, mounted as a hanging scroll on the full map; the Blueprint is the plan of an underground maze with a way in and a way out, rooms of all shapes joined by corridors, where an invisible pen draws and the odd red-pen circle appears; the Tissue Slide is drawn like an H&E-stained section (epithelium, glands, fibres, lymphoid tissue, cartilage, fat, vessels), red cells flow through the vessels, dividing cells line up their chromosomes and pull them apart, white cells gather where Clawd just stood, and now and then one chases down a bacterium and swallows it.
- **Deep Sky**: a sheet started without a session is transparent, and wherever it unfolds you see the real sky behind it. Both the direction and the scale are random: sometimes a wide star map (the Milky Way drawn from real galactic coordinates), sometimes a telescope-like close-up of one object, hundreds of tiles across. Sixty-odd famous galaxies, nebulae, clusters and bright stars sit at their real positions, coloured after Hubble and Webb images, bright stars wearing Webb's six-point spikes; walk up to one and Clawd tells you about it, and its name stays on the map. There's no day or night out there. The residents are aliens stitched together from science fiction (heptapods, furballs, antennates); their cities are ringed and banded planets, their temples are monoliths, and their history runs from Drifting and Landfall to Psychohistory and the Star Child. Things in the sky cross the sheet through the fourth direction: bright stars' cross-sections swell and shrink, meteors surface mid-sky, slide a little and vanish, a meteor going straight through burns a hole in the blank paper, and satellites swing back and forth along a line.
- **The residents' history** is played out from the seed the moment the world loads: population, eras (Wandering → Villages → City-states → Geometry → Awakening), towns, wars and temples, until they leave the paper. The same session always gives the same history. A four-dimensional being sees the whole timeline, so the faded entries in the annals are things that haven't happened yet.
- **Day and night** follow your real clock, or drag the time slider in the sense.exe window.
- **Full map** lays out the whole sheet as a downloadable PNG, and shows the conversation's 4D projection; on a Deep Sky sheet that page is a catalogue card for every object you've seen.
- Once the **Fill-in** upgrade is bought, a button fills every gap enclosed by where Clawd has walked. **Clear all** deletes every sheet's progress and loaded session on this machine, after two confirmations. The **Terrain** dropdown redraws the same sheet (same seed, same session) as another terrain, clearing that sheet's progress.
- **Pet = Lineland**: on the paper Clawd is solid, turning, stepping, swinging its arms and leaning as it walks, and turning back to face you when it stops; as a desktop pet, Clawd is flat too and the world collapses into a line. Wonders in the way get climbed, launched over, walked through (the forge), or stepped around through the fourth dimension. Linelanders see only the line, but Clawd sees the sheet behind it: where there are mountains and forests, layered peaks and treetops fade into the distance with mist drifting at their feet.
- The radio in the corner is synthesized live with WebAudio: ten stations, one per terrain (Deep Sky gets organ, a ticking pulse and slowly building arpeggios), each in its own style and made to loop for hours. It starts on the current sheet's station; » switches, and RND shuffles every few minutes.
- Switch between English and Chinese any time (the button next to the time slider).

## Layout

```
web/          the site itself (static, no build): index start page, game, viewer, parse.js log parsers, i18n.js language switch
  js/         game scripts, plain scripts loaded in order (shared global scope):
              world save/terrain/chunk canvas · ink the ink painting (scenes stitched together, mounting) · fx terrain animation · sky deep sky · life upgrades & walking · talk lines · ui panels · render drawing & main loop
              civ residents of each terrain · history the flat history · wonders road/wonders/full map · radio · pet desktop pet · start
src-tauri/    desktop shell (Tauri 2), serves web/ directly
test.mjs      parser tests
build.mjs     lowers web/ for the Kindle browser (about Chromium 74) into dist/ before deploying
```

## Development

```bash
node test.mjs                     # tests
npx serve web                     # view the site locally (any static server works)
npm install && npx tauri dev      # run the desktop app locally
```

All text is written as `tr('中文', 'English')`; static page text uses `data-en` attributes. See `web/i18n.js`.

Deploy the site: `npm run deploy` (runs `build.mjs` to produce dist/, then deploys dist/). Write modern syntax as usual, esbuild lowers it; but avoid functions Chrome 74 lacks, like `.at()` or `replaceAll`: the build refuses them.

Release the desktop app: bump the version in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `package.json` to the same new version, commit, and push a `v<version>` tag. GitHub Actions builds and publishes it, and installed copies update themselves.

## License

- Code: MIT
- Font: [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font), SIL OFL 1.1 (see `web/fonts/LICENSE-OFL.txt`)
- Clawd belongs to Anthropic. This is a fan project, not affiliated with Anthropic.
