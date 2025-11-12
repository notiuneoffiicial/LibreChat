import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { cn } from '~/utils';

type AnimatedOrbProps = {
  hue?: number;
  glow?: number;
  activityLevel?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Lightweight animated orb used in the onboarding flow.
 * This intentionally avoids WebGL so it works within the client bundle/root build.
 */
export default function AnimatedOrb({
  hue = 45,
  glow = 1,
  activityLevel = 0.5,
  className,
  style,
}: AnimatedOrbProps) {
  const baseHue = hue % 360;
  const accentHue = (baseHue + 40) % 360;
  const secondaryHue = (baseHue + 80) % 360;

  const coreGradient = useMemo(
    () =>
      `radial-gradient(circle at 30% 30%, hsla(${baseHue}, 85%, ${
        60 + activityLevel * 15
      }%, ${0.8 + activityLevel * 0.1}) 0%, hsla(${accentHue}, 80%, 65%, ${
        0.6 + activityLevel * 0.2
      }) 45%, hsla(${secondaryHue}, 70%, 50%, ${0.25 + glow * 0.1}) 80%, transparent 100%)`,
    [accentHue, activityLevel, baseHue, glow, secondaryHue],
  );

  const auraGradient = useMemo(
    () =>
      `radial-gradient(circle, hsla(${baseHue}, 90%, 75%, 0.35) 0%, hsla(${accentHue}, 90%, 65%, 0.2) 40%, transparent 70%)`,
    [accentHue, baseHue],
  );

  return (
    <div
      className={cn(
        'relative flex aspect-square w-[200px] max-w-[200px] items-center justify-center',
        className,
      )}
      style={style}
    >
      <div
        className="pointer-events-none absolute inset-0 scale-[1.45] blur-3xl opacity-70"
        style={{ background: auraGradient }}
      />
      <div
        className="pointer-events-none absolute inset-0 animate-[spin_18s_linear_infinite] rounded-full opacity-60"
        style={{
          background: `conic-gradient(from 90deg at 50% 50%, hsla(${accentHue},65%,70%,0.55), hsla(${baseHue},70%,65%,0.4), hsla(${secondaryHue},70%,60%,0.35), hsla(${accentHue},65%,70%,0.55))`,
        }}
      />
      <div
        className="relative aspect-square w-[82%] rounded-full shadow-[0_25px_60px_rgba(0,0,0,0.25)]"
        style={{
          background: coreGradient,
          boxShadow: `0 0 90px rgba(255, 255, 255, ${0.12 + glow * 0.08})`,
          animation: 'pulseOrb 6s ease-in-out infinite',
        }}
      />
      <style>
        {`
        @keyframes pulseOrb {
          0%, 100% { transform: scale(0.98); filter: brightness(0.95); }
          50% { transform: scale(1.03); filter: brightness(1.05); }
        }
        `}
      </style>
    </div>
  );
}

