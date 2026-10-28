import React, { useState } from "react";
import { Heart, MessageCircle, Send, Sparkles, Handshake, BadgePercent } from "lucide-react";
import { BrandMark } from "../Brand/Brand.js";
import { Photo } from "../ui/kit.js";
import { images } from "../../assets/images/imageUrls.js";

// Three illustrative posts on Dishky's social media. Tap a heart to like.
const posts = [
  { tag: "Spotlight", Icon: Sparkles, img: images.dishCurry, art: "post-spotlight", name: "Your Restaurant", line: "Come for the dish. Stay for the room." },
  { tag: "Collab", Icon: Handshake, img: images.chefPlating, art: "post-collab", name: "Dishky × Your Restaurant", line: "Made together." },
  { tag: "Offer", Icon: BadgePercent, img: images.dishDessert, art: "post-offer", name: "Weekend special", line: "Live this week." },
];

function Post({ post, className = "", style }) {
  const { Icon } = post;
  const [liked, setLiked] = useState(false);
  return (
    <article
      className={`group w-[min(70vw,230px)] shrink-0 overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] transition-transform duration-500 hover:z-20 hover:scale-105 ${className}`}
      style={style}
    >
      <header className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-3.5">
        <BrandMark className="h-6" />
        <div className="min-w-0">
          <p className="truncate font-display text-[12px] font-bold leading-tight text-ink">dishky</p>
          <p className="truncate text-[10px] leading-tight text-ink/50">{post.tag}</p>
        </div>
      </header>
      <div className="relative aspect-[4/4.4]">
        <Photo src={post.img} art={post.art} className="absolute inset-0" zoom />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
        <span className="absolute left-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur">
          <Icon size={16} />
        </span>
        <div className="absolute inset-x-4 bottom-4">
          <p className="font-display text-[15px] font-extrabold leading-tight text-white">{post.name}</p>
          <p className="mt-1 text-[11px] leading-snug text-white/85">{post.line}</p>
        </div>
      </div>
      <footer className="flex items-center gap-3 px-3.5 py-3 text-ink/70">
        <button type="button" aria-label="Like" onClick={() => setLiked((l) => !l)} style={{ minHeight: 0 }}>
          <Heart size={17} className={`transition-all duration-300 ${liked ? "scale-125 fill-amber text-amber" : ""}`} />
        </button>
        <MessageCircle size={17} />
        <Send size={17} />
      </footer>
    </article>
  );
}

/** A fanned stack of three "posts" with real photos. */
export default function PromoFeed({ className = "" }) {
  return (
    <div className={`relative mx-auto flex h-[430px] w-full max-w-[460px] items-center justify-center sm:h-[470px] ${className}`}>
      <div aria-hidden="true" className="absolute inset-x-6 top-10 h-[70%] rounded-full bg-neutral-500/20 blur-3xl" />
      <Post post={posts[0]} className="absolute left-0 top-10 -rotate-6 sm:left-2" />
      <Post post={posts[2]} className="absolute right-0 top-14 rotate-6 sm:right-2" />
      <Post post={posts[1]} className="relative z-10 -translate-y-2" style={{ animation: "dk-float 6s ease-in-out infinite" }} />
    </div>
  );
}
