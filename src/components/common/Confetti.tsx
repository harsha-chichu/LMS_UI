"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#ff6a00", "#ffb27a", "#ffffff", "#ffd27a", "#ff8a3d"];
const DURATION_MS = 3200;

type Piece = { x: number; y: number; vx: number; vy: number; size: number; rot: number; vr: number; color: string; round: boolean };

/**
 * A short burst of confetti from both bottom corners, drawn on a canvas that
 * ignores clicks. Skipped for people who prefer reduced motion.
 */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const w = window.innerWidth;
    const h = window.innerHeight;
    const count = Math.min(160, Math.round(w / 6));
    const pieces: Piece[] = Array.from({ length: count }, (_, i) => {
      const left = i % 2 === 0;
      const angle = ((left ? -60 : -120) + (Math.random() - 0.5) * 40) * (Math.PI / 180);
      const speed = 9 + Math.random() * 9;
      return {
        x: left ? 0 : w,
        y: h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * (h / 700),
        size: 5 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[i % COLORS.length],
        round: Math.random() < 0.3,
      };
    });

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = t > DURATION_MS - 800 ? Math.max(0, (DURATION_MS - t) / 800) : 1;
      for (const p of pieces) {
        p.vy += 0.28;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }
      if (t < DURATION_MS) frame = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />;
}
