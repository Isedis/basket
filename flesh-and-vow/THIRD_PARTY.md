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
