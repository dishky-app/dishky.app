import React, { useMemo } from "react";
import { ACTIVE_PRELOADER } from "../../config/preloader.js";
import Shutter from "./designs/Shutter.js";
import Words from "./designs/Words.js";
import Knockout from "./designs/Knockout.js";
import Curtain from "./designs/Curtain.js";
import Beam from "./designs/Beam.js";
import Bars from "./designs/Bars.js";
import Scramble from "./designs/Scramble.js";
import Focus from "./designs/Focus.js";
import Signal from "./designs/Signal.js";
import Dial from "./designs/Dial.js";

/**
 * Preloader switchboard. Every design takes the same prop ({ onComplete })
 * and is fully self-contained, so you can also import any one of them
 * directly in App.js instead of this file.
 */
export const PRELOADERS = {
  shutter: Shutter,
  words: Words,
  knockout: Knockout,
  curtain: Curtain,
  beam: Beam,
  bars: Bars,
  scramble: Scramble,
  focus: Focus,
  signal: Signal,
  dial: Dial,
};
const ORDER = ["shutter", "words", "knockout", "curtain", "beam", "bars", "scramble", "focus", "signal", "dial"];

function pick() {
  let wanted = ACTIVE_PRELOADER;
  if (typeof window !== "undefined") {
    // ?preloader=curtain  or  ?preloader=4  (1-10, in the order above)
    const q = new URLSearchParams(window.location.search).get("preloader");
    if (q) wanted = /^([1-9]|10)$/.test(q) ? ORDER[Number(q) - 1] : q.toLowerCase();
  }
  return PRELOADERS[wanted] || Shutter;
}

export default function Preloader(props) {
  const Design = useMemo(pick, []);
  return <Design {...props} />;
}
