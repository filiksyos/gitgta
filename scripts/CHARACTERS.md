# Character pipeline and review

The player uses Tommy. Ambient characters use nightlife, floral, and weathered variants. Officers use the weathered rig with a navy material tint. Each instance has its own skeleton and animation mixer; immutable geometry and textures are shared.

The supplied Meshy files were static, unskinned meshes. The generator adds 19 joints, four normalized weights per vertex, a small lower-face speech morph, and 14 animation clips. Source files remain untouched. UV-preserving mesh simplification reduces Tommy from 100,000 to 16,000 triangles and most active NPCs to approximately 9,000–13,000 triangles.

## Regenerate

Python dependencies: numpy, scipy, Pillow, opencv-python (the latter is only for the software review movie). The optimizer uses meshoptimizer 1.3.0 via a local tool installation; install version 1.3.0.

```powershell
npm install --prefix .tools/mesh meshoptimizer@1.3.0
python scripts/rig_characters.py --prepare
node scripts/optimize-characters.mjs
python scripts/rig_characters.py
python scripts/validate_characters.py
node scripts/check-character-runtime.mjs
node scripts/check-conversation.mjs
```

The source path is configured in `scripts/inspect_characters.py`. Anatomical landmarks, bind pose corrections, skin weighting, and animation parameters are in `scripts/rig_characters.py`.

## Review outputs

`artifacts/characters/` is intentionally ignored by git. It contains source contact sheets, landmark overlays, rig reports, numerical animation reports, runtime checks, browser recordings, and the final software-rendered review movie. The software renderer evaluates the actual exported GLB channels and skin weights at a fixed frame rate; it is an orthographic diagnostic view, not an in-game gameplay recording.

```powershell
python scripts/render-character-review.py
& 'C:\Program Files\Shotcut\ffmpeg.exe' -framerate 24 -i artifacts/characters/software-frames/%05d.jpg -c:v libx264 -pix_fmt yuv420p artifacts/characters/character-movement-review.mp4
```

The optional local preview server is for development only. Run it from the repository root and open `http://127.0.0.1:8765/artifacts/characters/preview.html`:

```powershell
python scripts/character-preview-server.py
```

## Known limits and quarantined assets

The casual, executive, summer, suit, and white-dress meshes have crossed limbs, connected clothing, collapsed sleeves, or posed geometry that still produces visible deformation issues. Their generated drafts are saved under `artifacts/characters/drafts/`, never shipped in the active character pool. The family file is a multi-person mesh and is not treated as a single NPC.

Clips are authored procedural movement, not motion capture. Hands are attached to the forearm chain; individual fingers are not articulated. Speech uses generic browser text-to-speech with subtitles and a basic mouth morph, not Tommy's original voice or phoneme-accurate lip-sync. NPCs speak brief ambient lines; this is not an open-ended conversation system. The player is hidden while inside vehicles, as in the existing game.

Checks cover finite skin matrices, normalized weights, loop continuity, sampled ground clearance, independently cloned skeletons, hand movement, repeated animation transitions, speech morphs, and dialogue cleanup. These checks and visual reviews reduce defects; they do not establish perfect animation on every device or interaction.




For solid textured review frames, install moderngl 5.13.0 under `.tools/gpu` and use `scripts/render-textured-review.py`. Its movie also includes the rejected casual variant for comparison. The point-splat renderer remains a geometry diagnostic.
