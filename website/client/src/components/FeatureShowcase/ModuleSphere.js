import React from "react";
import { useNavigate } from "react-router-dom";
import InfiniteMenu from "../ReactBits/InfiniteMenu.js";
import LazyGL from "../ReactBits/LazyGL.js";
import usePhotos from "../ReactBits/usePhotos.js";
import { artFor } from "../ui/Art.js";
import { modules } from "../../data/modules.js";

/** Every module on a full-width sphere of photos: drag to spin, and the one in front opens its own page. */
export default function ModuleSphere() {
  return (
    <LazyGL className="dk-bleed dk-sphere relative h-[72vh] min-h-[520px] overflow-hidden bg-white md:h-[85vh]">
      <SphereScene />
    </LazyGL>
  );
}

function SphereScene() {
  const go = useNavigate();
  const urls = usePhotos(modules.map((m) => ({ photo: m.photo, art: artFor[m.slug] || "menu" })));
  const narrow = typeof window !== "undefined" && window.innerWidth < 640;
  return (
    <>
      {urls && (
        <InfiniteMenu
          items={modules.map((m, i) => ({ image: urls[i], title: m.name, description: m.short, path: m.path }))}
          count={150}
          tileSize={0.4}
          roundness={0.3}
          zoom={narrow ? 0.8 : 1.0}
          autoplay={3.5}
          grayscale={false}
          dim={0.1}
          theme="light"
          accentColor="#f33716"
          backgroundColor="#ffffff"
          onItemClick={(it) => go(it.path)}
        />
      )}
    </>
  );
}
