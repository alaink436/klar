"use client";

import { useEffect, useRef, useState } from "react";

// An app's own film (the App Store header or search video), muted and looping.
// `wide` is the 21:9 cut for desktop, `tall` the 3:2 cut for phones; each is a
// path without extension, with `.mp4` and a `.jpg` poster next to it. Plays only
// while on screen, so six films on one page do not all decode at once.

type Props = {
  wide: string;
  tall?: string;
  label: string;
  className?: string;
};

export default function Film({ wide, tall, label, className = "" }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const pick = () => setSrc(!tall || mq.matches ? wide : tall);
    pick();
    mq.addEventListener("change", pick);
    return () => mq.removeEventListener("change", pick);
  }, [wide, tall]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? v.play().catch(() => {}) : v.pause()),
      { threshold: 0.15 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [src]);

  return (
    <div className={`overflow-hidden ${className}`}>
      {src && (
        <video
          ref={video}
          key={src}
          className="h-full w-full object-cover"
          src={`${src}.mp4`}
          poster={`${src}.jpg`}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={label}
        />
      )}
    </div>
  );
}
