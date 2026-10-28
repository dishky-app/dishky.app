import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Art from "../ui/Art.js";

const cache = {};
/**
 * Renders one of the site's illustrations to an image URL that the WebGL and
 * CSS 3D components can use as a texture. Only the <svg> element is kept, so
 * it also works if <Art> wraps the drawing in other markup (for example the
 * photo overlay version of Art.js).
 */
export function artImage(kind, dark = true) {
  const key = kind + (dark ? "d" : "l");
  if (cache[key]) return cache[key];
  const html = renderToStaticMarkup(<Art kind={kind} dark={dark} />);
  const start = html.indexOf("<svg");
  const end = html.lastIndexOf("</svg>");
  const svg = html
    .slice(start, end + 6)
    .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" ');
  cache[key] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  return cache[key];
}
