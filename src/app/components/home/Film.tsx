"use client";

import { useEffect, useRef, useState } from "react";

// An app's own film (the App Store header or search video), muted and looping.
// `wide` is the 21:9 cut for desktop, `tall` the 3:2 cut for phones; each is a
// path without extension, with `.mp4` and a `.jpg` poster next to it. Plays only
// while on screen, so six films on one page do not all decode at once.
// On iPhone the film is not a <video> at all: iOS opened its own full-screen
// player each time a film started as a card swiped into view (Alain, 2026-10-14
// and again 10-15, likely the TikTok in-app browser, which plays no video
// inline). WebKit plays a muted MP4 inside an <img> like a GIF, which has no
// player to open; if that fails the poster stays. Elsewhere it is a <video>
// that takes no touches, without picture-in-picture or AirPlay.

type Props = {
  wide: string;
  tall?: string;
  label: string;
  className?: string;
};

export default function Film({ wide, tall, label, className = "" }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [ios, setIos] = useState(false);
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const iPhone = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const mq = window.matchMedia("(min-width: 768px)");
    const pick = () => {
      setIos(iPhone);
      setSrc(!tall || mq.matches ? wide : tall);
    };
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
      {src && ios && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={failed ? `${src}.jpg` : `${src}.mp4`}
          alt={label}
          onError={() => setFailed(true)}
          className="pointer-events-none h-full w-full select-none object-cover"
        />
      )}
      {src && !ios && (
        <video
          ref={video}
          key={src}
          className="pointer-events-none h-full w-full object-cover"
          src={`${src}.mp4`}
          poster={`${src}.jpg`}
          muted
          loop
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          preload="metadata"
          aria-label={label}
        />
      )}
    </div>
  );
}
