// Which preloader the site shows. Change this one line to switch:
//
//   1  "shutter"   dark, big 00-100% counter, screen opens as vertical shutters
//   2  "words"     kinetic type: Orders, Kitchen, Stock... flash by, then closes to a slit
//   3  "knockout"  DISHKY cut out of a dark screen; the view dives into the letter I
//   4  "curtain"   calm logo + hairline; lifts away as a curtain with a curved edge
//   5  "beam"      glass card with a light beam around its border; grows to fill the screen
//   6  "bars"      full-screen bar chart rises, surges red, columns lift away
//   7  "scramble"  light: slot-reel letters spell DISHKY; interlaced columns open
//   8  "focus"     dark, cinematic: the logo hunts for focus, viewfinder locks, soft flash
//   9  "signal"    dark: fine lines carry a wave that swells then settles flat; lines retract
//   10 "dial"      light, watch-face: 72 ticks turn red clockwise; the dial zooms past you
//
// Quick comparison without editing code: add  ?preloader=curtain  (or 1 to 10)
// to the URL, e.g.  http://localhost:5173/?preloader=4
export const ACTIVE_PRELOADER = "shutter";
