# Tommy original-rig cloud handoff

This is an unfinished checkpoint, not a release. The user explicitly wants this work continued in Codex Cloud so their PC can be closed. Main character movement is the priority. Leave the NPC work alone.

## User's goal

Adapt the supplied Tommy Vercetti mesh to the ORIGINAL packaged player rig and its authored Idle, Walk, and Run animations. The earlier armored/robot-like player moved naturally; use that movement as the benchmark. Do not generate another procedural walk or replace the original movement system. The user mentions Quaternius/Meshy; the actual existing GLB uses Mixamo-named bones. Preserve the asset's actual rig and clips instead of assuming a different framework.

## Assets

- `public/models/player.glb`: original armored player, unchanged. Source skeleton, skin inverse bind matrices, animation channels and animation buffers must remain intact. Contains Idle, Walk, Run, and TPose; it does not contain the many combat/jump clips that the earlier procedural generator fabricated.
- `assets/source/tommy-meshy-original.glb`: pristine static Tommy Meshy mesh copied from the user's Desktop. No rig or clips. This is the raw source for proper topology/weight work.
- `public/models/characters/tommy.glb`: earlier optimized (16,000 triangles) Tommy with a custom 19-joint rig and procedural clips. It is an intermediate/source of geometry only, NOT the approved player animation system.
- `public/models/characters/tommy-original-rig.glb`: current experimental fit to original rig. It preserves source skeleton and animation data, but has visible shirt/hand/waist deformation defects. NOT approved quality.
- `assets/review/tommy-original-rig-current-defects.jpg`: side-by-side original/experimental walk frame showing the current visible defects.

## Current code/state

`game/render/heroes.ts` loads `tommy-original-rig.glb`, maps source Idle/Walk/Run to game state aliases, and avoids resetting fallback actions every frame. `game/render/view.ts` restores the original player facing and authored animation speed and adds sole alignment. `game/systems/player.ts` uses the original walk/sprint speeds (6.4/9.2). The original player file is preserved.

Other uncommitted work from the same task is included in this checkpoint: three varied NPC assets, independent mixers, and basic proximity dialogue. Do not expand or rework this; the user explicitly says they do not care about the NPCs compared with the main character.

## What went wrong / what NOT to repeat

The first assistant-created rig/procedural gait was unacceptable. Passing finite-matrix, loop or weight-sum checks DOES NOT mean a natural walk or a good mesh. A lot of time was spent rendering diagnostics without achieving acceptable skin deformation. Do not claim the model is perfect or fixed just because a numeric test passes.

The current adapter in `scripts/adapt-tommy-to-original-rig.py` inverse-binds an Idle reference pose, attempts clothing/skin color segmentation, fits landmarks, and calls `scripts/separate_tommy_contacts.py` to split/cap contact surfaces. It is an experimental prototype, not a required algorithm. Hand, shirt and trouser contact surfaces still form strips and patches; some changes worsened the mesh. Use proper DCC tools/Blender, topology inspection, weight transfer, and manual/anatomical corrections rather than repeatedly tuning brittle per-color or coordinate thresholds.

The last contemplated idea was rebuilding only damaged body regions with clean topology while retaining Tommy's head/clothing appearance and binding to the ORIGINAL skeleton. This has NOT been implemented. The user interrupted to request cloud execution. Decide based on evidence whether proper weight repair or localized topology repair is sufficient; avoid unnecessarily replacing the entire body or inventing new animation.

## Verification and completion

1. Clone/fetch this checkpoint branch, inspect the raw GLBs and existing code. Never overwrite the original player.glb.
2. Establish an original-vs-Tommy comparison using the same source clips/timestamps. Inspect front, rear, and side across full walk/run cycles; check wrists, shoulders, hip contact, knees, soles, twists, stretched triangles, self intersections, and transitions in the actual game.
3. Fix the mesh/weights on the existing skeleton; preserve source clips and correct rest/bind transforms.
4. Record and visually review full motion, not just individual images. Iterate on defects. Rendered diagnostics must honestly be described as diagnostics, not actual gameplay footage.
5. Test aliases and skinning with `node scripts/check-original-rig.mjs`, TypeScript, ESLint, production build, and actual in-game visual behavior. The old 19-bone validation scripts do not directly apply to the new original skeleton.
6. `scripts/review-original-rig.py` is a standalone offscreen comparison renderer. It uses moderngl and may need EGL/Xvfb on Linux. Adapt its setup as necessary. Its raw diagnostic output currently omits the runtime sole-alignment offset.
7. Existing scripts have Windows source/tool paths; use `assets/source/` and Linux dependencies instead. No files under `.tools/` or `artifacts/` were uploaded. NumPy/SciPy/Pillow, meshoptimizer, Three.js and ffmpeg were used locally. Prefer proper Blender rig/topology tooling for the repair if available.
8. The local browser automation stalled during the attempted final in-game check. Do NOT report that latest in-game visual check as passed. Earlier original and procedural variants were viewed, but current asset quality remains unfinished.
9. Continue on an unmerged work branch. Do not merge or deploy this defective checkpoint. Once a genuinely improved character is reviewable, return the result and honest remaining limits. User has not asked to deploy this current character change yet.

## Snapshot meaning

The branch includes all current local character work so cloud can continue independently of the Windows PC. Environment secrets, .env.local, local helper installations, and large intermediate captures are excluded. The repository is public. The source asset and review image were explicitly transferred as necessary for the user's requested cloud continuation.
