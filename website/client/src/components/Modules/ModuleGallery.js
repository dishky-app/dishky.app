import React, { useEffect, useState } from "react";
import CircularGallery from "../ReactBits/CircularGallery.js";
import LazyGL from "../ReactBits/LazyGL.js";
import usePhotos from "../ReactBits/usePhotos.js";
import { journeyScenes } from "./ModuleBlocks.js";

/** A module's story steps and features on the same curved WebGL gallery as the landing page. */
export default function ModuleGallery({ module: m }) {
  return (
    <LazyGL className="dk-bleed relative h-[18rem] overflow-hidden bg-white md:h-[24rem]">
      <Scene m={m} />
    </LazyGL>
  );
}

function Scene({ m }) {
  const scenes = journeyScenes(m.slug);
  const cards = m.journey.map((s, i) => ({ photo: s.photo, art: scenes[i % scenes.length], text: s.title }));
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 768);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  // The ring needs enough cards to curve nicely, so repeat short stories.
  const list = cards.length >= 6 ? cards : cards.concat(cards).concat(cards).slice(0, Math.max(6, cards.length * 2));
  const urls = usePhotos(list.map((c) => ({ photo: c.photo, art: c.art })));
  if (!urls) return null;
  return (
    <CircularGallery
      items={list.map((c, i) => ({ image: urls[i], text: c.text }))}
      bend={narrow ? 2.5 : 5}
      textColor="#0a0a0a"
      borderRadius={0.12}
      font="bold 24px Sora"
      scrollSpeed={2}
      scrollEase={0.05}
    />
  );
}
