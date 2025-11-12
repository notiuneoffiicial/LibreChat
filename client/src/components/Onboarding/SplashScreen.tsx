import AnimatedOrb from './AnimatedOrb';

type SplashScreenProps = {
  headline?: string;
  subtext?: string;
};

export default function SplashScreen({
  headline = 'Preparing your Optimist’s Lens…',
  subtext = 'Just a moment while we get things ready.',
}: SplashScreenProps) {
  return (
    <div className="fixed inset-0 z-[2100] flex min-h-screen flex-col items-center justify-center bg-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#f3e4ff4d_0%,transparent_55%),radial-gradient(circle_at_bottom,#ffe6dd66_0%,transparent_50%)]" />
      <div className="relative flex flex-col items-center gap-6 text-center">
        <AnimatedOrb
          hue={320}
          glow={0.8}
          activityLevel={0.2}
          className="w-[140px] md:w-[180px]"
          style={{ filter: 'drop-shadow(0 25px 45px rgba(219, 196, 248, 0.35))' }}
        />
        <div className="space-y-2">
          <p className="text-base font-medium text-slate-800">{headline}</p>
          <p className="text-sm text-slate-500">{subtext}</p>
        </div>
      </div>
    </div>
  );
}

