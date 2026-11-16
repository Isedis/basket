# Third-party components

Engine: Godot 4.6.3, MIT license. See https://godotengine.org/license/.
The Windows executable contains the official Godot runtime and the embedded game.

Fonts: DejaVu Sans and DejaVu Sans Bold, from the DejaVu fonts project.
The complete copyright/license notice is included in assets/FONT_LICENSE.txt.

All actor sprites, item icons, interface, code, names and text in this prototype
were created for this project. No assets from The Binding of Isaac are included.


Version 0.3 art: castle environment, prisoner and guard animation sheets were
created for this project using image generation. Original source PNGs are
preserved; runtime samples the sheets on a consistent pixel grid. Other
articulated sprite sheets are drawn by tools/draw_actors.py.
Press Start 2P font: SIL Open Font License; see assets/PIXEL_FONT_LICENSE.txt.

Version 0.4.3 character art: the prisoner, warden and assassin component masters
were created for this project using image generation, then prepared as a native
256x288 atlas with per-character palettes. The game uses castle_characters.png
and fixed component regions; it does not rescale illustration masters at runtime.

Version 0.4.4 castle tiles: an original modular castle master was created for
this project using image generation, then prepared as a native 256x128 atlas
with fixed component dimensions and limited material palettes. Large masters
are not shipped or rescaled by the game. Original source art uses no third-party
game assets.

Castle room review art: sculpted masonry and eight isolated props were created
for this project using image generation. Runtime uses castle_masonry.png
(384x144) and castle_props.png (256x128), with hard alpha and fixed native
sprite sizes. Large generation masters remain outside the game project.

Door review art: original directional stone frames and separate iron/oak
inserts were created for this project using image generation. Runtime uses
castle_doors.png (256x192) with fixed native component dimensions; large
illustration masters remain outside the exported game project.

Version 0.5.0 special-room furniture: the merchant stall, rack, paired altars,
mirror, pedestal, stairs and relic stand were created for this project using
image generation and prepared as castle_special.png with fixed native sprite
dimensions. The large master is not exported or published with the game.

Version 0.5.1 hazard art: original pit, puddle, trap and furnace components
were created for this project using image generation, then prepared as
castle_hazards.png (128x128) with hard alpha and fixed native dimensions.
The game reuses one needle at twelve fixed sockets and keeps bases separate
from moving parts. The illustration master is not exported or published.

Version 0.5.2 ordinary enemy art: skeleton, shadow and mage component masters
were generated for this project, then baked into castle_enemies.png (256x320)
with fixed native sizes, hard alpha and limited material palettes. The three
large masters and private gameplay captures are not exported or published.

Version 0.6.0: Bell Executioner component art and arena seal were generated
for this project, then baked into castle_boss.png and castle_boss_seal.png
with fixed native sizes, hard alpha and limited palettes. Large masters and
private review media are not distributed. boss_bell.wav, boss_impact.wav and
boss_break.wav are original deterministic additive/noise synthesis.

Version 0.6.4: boss_body.png contains original assembled full-body artwork
generated from this project's boss reference and baked at native size with
hard alpha, a limited palette and a single connected body silhouette per
view. The illustration master remains private and is not distributed.


Version 0.6.6: boss_flesh.wav, boss_stone.wav and boss_swing.wav are original
additive/noise synthesis created for this project. No third-party samples
are used. Private gameplay review media are not distributed.


Version 0.6.8: boss_step.wav, boss_launch.wav and boss_brake.wav are original
additive/noise synthesis for this project, without third-party samples.
Private review captures are not exported or published with the game.
