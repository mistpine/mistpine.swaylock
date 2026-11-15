#!/bin/sh
# Runs inside the swaylock image: locks headless sway with themes/mistpine.conf
# and walks the lock screen through its states, typing with wtype. Each
# state is cropped to the ring and left in /out as <state>.png, with raw
# pixels (.rgb) and size (.size) for the checks; /out/swaylock.log is
# everything swaylock printed.
#   /themes  this repository's themes/ (read-only)
# States: typing, backspace, cleared, capslock, verifying, and wrong-1 …
# wrong-12, one every half second after Enter: PAM takes about 3 s to
# refuse the password and the ring is red for about 2 s after that.
set -u
export LANG=C.UTF-8
export XDG_RUNTIME_DIR=/tmp/xdg && mkdir -p -m 700 $XDG_RUNTIME_DIR
# 1000×700 points at scale 2; the ring is centered, 100 points in radius.
printf 'output * resolution 2000x1400 scale 2 bg #000000 solid_color\nxwayland disable\n' > /tmp/sway.conf
WLR_BACKENDS=headless WLR_RENDERER=pixman WLR_LIBINPUT_NO_DEVICES=1 \
  sway --unsupported-gpu -c /tmp/sway.conf >/tmp/sway.log 2>&1 &
for _ in $(seq 100); do [ -e $XDG_RUNTIME_DIR/wayland-1 ] && break; sleep 0.1; done
export WAYLAND_DISPLAY=wayland-1 SWAYSOCK=$(ls $XDG_RUNTIME_DIR/sway-ipc.*.sock)

swaylock --version > /out/version
# The theme as shipped; sizes, font and --indicator-caps-lock (Caps Lock
# colors on the ring, not only in the text) are the screenshots' own.
swaylock -C /themes/mistpine.conf --font 'JetBrains Mono' --indicator-radius 100 \
  --indicator-thickness 10 --font-size 40 --indicator-caps-lock > /out/swaylock.log 2>&1 &
sleep 1.5

shot() { # shot <name>: the ring and some canvas around it
  grim /tmp/full.png
  convert /tmp/full.png -crop 560x560+720+420 +repage "/out/$1.png"
  convert "/out/$1.png" -depth 8 "rgb:/out/$1.rgb"
  echo "560 560" > "/out/$1.size"
}
# Every wtype run uploads its own keymap: wait (-s) before its first key,
# or swaylock may read that key with the previous keymap.
wtype() { command wtype -s 300 "$@"; }
wtype mistpine; sleep 0.3; shot typing
wtype -k BackSpace; sleep 0.3; shot backspace
wtype -M ctrl u -m ctrl; sleep 0.3; shot cleared
wtype -M capslock m; sleep 0.3; shot capslock
wtype -m capslock; wtype -M ctrl u -m ctrl; sleep 1.5
wtype wrong; wtype -k Return; sleep 0.3; shot verifying
for i in $(seq 12); do sleep 0.5; shot "wrong-$i"; done
exit 0
