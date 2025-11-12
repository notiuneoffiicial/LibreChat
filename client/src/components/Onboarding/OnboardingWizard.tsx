import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Input } from '@librechat/client';
import { Volume2, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import AnimatedOrb from './AnimatedOrb';
import { cn } from '~/utils';

const BRAND_VIOLET = '#6F4DEF';
const BRAND_INK = '#06070F';

type ThemeChoice = 'warm-amber' | 'cool-teal' | 'rose-quartz' | 'graphite';

type OnboardingData = {
  purposes: string[];
  communicationStyle: {
    formality: number;
    depth: number;
    challenge: number;
  };
  cognitiveStyles: string[];
  motivation: string;
  memoryEnabled: boolean;
  forgetAfterSession: boolean;
  memoryNotes: string;
  importOptions: {
    chats: boolean;
    documents: boolean;
    images: boolean;
  };
  useCasePrimary: string | null;
  useCaseSecondary: string | null;
  privacy: {
    rememberSummaries: boolean;
    syncAcrossDevices: boolean;
    allowDeletion: boolean;
    collectiveInsights: boolean;
  };
  displayName: string;
  aiNickname: string;
  theme: ThemeChoice;
  voice: string;
  lensBalance: number;
};

const PURPOSE_OPTIONS = [
  {
    id: 'personal-growth',
    title: 'Personal Growth',
    description: 'Reflection, mindset, emotional support.',
    icon: '🌱',
  },
  {
    id: 'creative-exploration',
    title: 'Creative Exploration',
    description: 'Ideas, writing, brainstorming.',
    icon: '💡',
  },
  {
    id: 'professional-reasoning',
    title: 'Professional Reasoning',
    description: 'Decision support, clarity, logic.',
    icon: '⚙️',
  },
  {
    id: 'philosophical-inquiry',
    title: 'Philosophical Inquiry',
    description: 'Meaning, purpose, curiosity.',
    icon: '🌍',
  },
];

const COGNITIVE_STYLES = [
  { id: 'analytical', label: '🧠 Analytical' },
  { id: 'reflective', label: '💭 Reflective' },
  { id: 'visual', label: '🎨 Visual' },
  { id: 'conversational', label: '🗣️ Conversational' },
];

const MOTIVATION_OPTIONS = ['Curiosity', 'Progress', 'Harmony', 'Mastery'] as const;

const IMPORT_OPTIONS = [
  {
    id: 'chats',
    title: 'Import past chats',
    description: 'Bring conversations from ChatGPT, Claude, and more.',
    icon: '📥',
  },
  {
    id: 'documents',
    title: 'Upload documents or notes',
    description: 'PDF, TXT, DOCX — give OptimismAI context quickly.',
    icon: '📄',
  },
  {
    id: 'images',
    title: 'Upload images or screenshots',
    description: 'Include whiteboards, mood boards, or inspiration.',
    icon: '🖼️',
  },
];

const USE_CASE_OPTIONS = [
  {
    id: 'companion',
    title: 'Companion',
    description: 'Personal reflection, journaling, and ongoing dialogue.',
    icon: '💬',
  },
  {
    id: 'study',
    title: 'Study / Research Assistant',
    description: 'Learn faster, review concepts, and explore research.',
    icon: '📚',
  },
  {
    id: 'strategy',
    title: 'Decision-Making & Strategy',
    description: 'Work through choices and gain clarity on next steps.',
    icon: '🧭',
  },
  {
    id: 'support',
    title: 'Emotional Support / Life Guidance',
    description: 'Navigate life’s moments with a grounded ally.',
    icon: '🪞',
  },
  {
    id: 'knowledge-base',
    title: 'Knowledge Base / Memory Engine',
    description: 'Store and retrieve insights, keep projects organised.',
    icon: '🧠',
  },
];

const THEME_CHOICES: { id: ThemeChoice; label: string; description: string; gradient: string }[] = [
  {
    id: 'warm-amber',
    label: 'Warm Amber',
    description: 'Empathy & encouragement',
    gradient: 'from-[#FFD6A0] via-[#FFC4A3] to-[#FFE9C1]',
  },
  {
    id: 'cool-teal',
    label: 'Cool Teal',
    description: 'Clarity & calm focus',
    gradient: 'from-[#79E0EF] via-[#92EAFF] to-[#C8F7FF]',
  },
  {
    id: 'rose-quartz',
    label: 'Rose Quartz',
    description: 'Gentleness & compassion',
    gradient: 'from-[#FFB5D8] via-[#FFCFDF] to-[#FFE4EE]',
  },
  {
    id: 'graphite',
    label: 'Graphite',
    description: 'Minimal, understated',
    gradient: 'from-[#3D4451] via-[#232832] to-[#141820]',
  },
];

const VOICE_OPTIONS = ['No Voice', 'Warm Echo', 'Serene Wave', 'Lively Spark', 'Quiet Muse'];

const initialState: OnboardingData = {
  purposes: [],
  communicationStyle: {
    formality: 2,
    depth: 2,
    challenge: 2,
  },
  cognitiveStyles: [],
  motivation: '',
  memoryEnabled: false,
  forgetAfterSession: true,
  memoryNotes: '',
  importOptions: {
    chats: false,
    documents: false,
    images: false,
  },
  useCasePrimary: null,
  useCaseSecondary: null,
  privacy: {
    rememberSummaries: false,
    syncAcrossDevices: false,
    allowDeletion: true,
    collectiveInsights: false,
  },
  displayName: '',
  aiNickname: '',
  theme: 'warm-amber',
  voice: 'No Voice',
  lensBalance: 50,
};

const getLensLabel = (balance: number) => {
  if (balance < 33) {
    return 'Leaning Optimism';
  }
  if (balance > 67) {
    return 'Leaning Clarity';
  }
  return 'Balanced';
};

const toggleSelection = (list: string[], value: string) => {
  if (list.includes(value)) {
    return list.filter((item) => item !== value);
  }
  return [...list, value];
};

interface ScreenConfig {
  title?: string;
  description?: string;
  highlight?: string;
  content: React.ReactNode;
  nextLabel?: string;
  nextDisabled?: boolean;
  showNext?: boolean;
}

type OnboardingWizardProps = {
  onComplete: () => Promise<void> | void;
};

const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_45px_rgba(0,0,0,0.18)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A996F9] hover:bg-black/90 active:translate-y-[1px] motion-reduce:transition-none motion-reduce:active:translate-y-0';
const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A996F9] hover:border-[#B8A9FF] hover:text-[#6F4DEF] active:translate-y-[1px] motion-reduce:transition-none motion-reduce:active:translate-y-0';

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [previewVoice, setPreviewVoice] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [data, setData] = useState<OnboardingData>(initialState);

  useEffect(() => {
    if (!previewVoice) {
      return;
    }
    const timeout = setTimeout(() => setPreviewVoice(null), 1500);
    return () => clearTimeout(timeout);
  }, [previewVoice]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(media.matches);
    const listener = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const handleThemeSelect = useCallback((choice: ThemeChoice) => {
    setData((prev) => ({ ...prev, theme: choice }));
  }, []);

  const screenConfigs = useMemo<ScreenConfig[]>(
    () => [
      {
        highlight: 'Orientation',
        content: (
          <div className="grid gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:items-center">
            <div className="relative rounded-[30px] border border-white/60 bg-white p-8 shadow-[0_35px_80px_rgba(45,35,95,0.09)]">
              <span className="pointer-events-none absolute -top-20 -left-24 h-60 w-60 rounded-full bg-[radial-gradient(circle,#ffe6d7_0%,transparent_65%)] opacity-80" />
              <span className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,#ecdefd_0%,transparent_70%)] opacity-90" />
              <div className="relative space-y-4 text-left">
                <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Welcome to OptimismAI.</h1>
                <p className="text-base text-slate-600">
                  Before we begin, let’s tune your lens—so I can understand how to partner with you best.
                </p>
                <p className="text-sm text-slate-500">This takes about a minute, and you can revisit it anytime.</p>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
                  <span className="size-2 rounded-full bg-[#bfa5ff]" />
                  Crafted to match the landing lens aesthetic
                </div>
              </div>
            </div>
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-4 rounded-[32px] bg-[radial-gradient(circle_at_top,#f6eaff_0%,transparent_75%)] opacity-90" />
              <div className="relative rounded-[32px] border border-white/70 bg-white p-8 shadow-[0_30px_80px_rgba(61,49,120,0.1)]">
                <AnimatedOrb
                  hue={320}
                  glow={0.9}
                  activityLevel={prefersReducedMotion ? 0.1 : 0.35}
                  className="w-[220px] md:w-[240px]"
                  style={{ filter: 'drop-shadow(0 30px 55px rgba(224, 205, 255, 0.45))' }}
                />
              </div>
            </div>
          </div>
        ),
        nextLabel: 'Get Started',
      },
      {
        title: 'What brings you to OptimismAI today?',
        description:
          'Choose anything that resonates. We’ll shape your default pacing, tone, and model presets around what matters most.',
        highlight: 'Multi-select',
        content: (
          <div className="grid gap-4 md:grid-cols-2">
            {PURPOSE_OPTIONS.map((option) => {
              const selected = data.purposes.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    setData((prev) => ({
                      ...prev,
                      purposes: toggleSelection(prev.purposes, option.id),
                    }))
                  }
                  className={cn(
                    'group relative flex h-full flex-col rounded-[26px] border border-slate-200 bg-white p-6 text-left shadow-sm transition-[transform,box-shadow,border-color] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A996F9] hover:-translate-y-[3px] hover:shadow-[0_25px_60px_rgba(45,35,95,0.12)] motion-reduce:transform-none motion-reduce:shadow-none',
                    selected &&
                      'border-[#8B76FF] shadow-[0_30px_70px_rgba(108,89,255,0.18)] ring-4 ring-[#8B76FF26] bg-[#F7F3FF]',
                  )}
                >
                  <span className="pointer-events-none absolute -top-5 -left-4 h-16 w-16 rounded-full bg-[radial-gradient(circle,#fbe7ff_0%,transparent_70%)] opacity-80" />
                  <div className="mb-4 text-3xl">{option.icon}</div>
                  <h3 className="text-lg font-semibold text-slate-900">{option.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{option.description}</p>
                  {selected && (
                    <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#6F4DEF]">
                      <Check size={14} />
                      Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ),
        nextLabel: 'Next',
      },
      {
        title: 'How would you like me to communicate with you?',
        description: 'Dial in tone, depth, and how much I challenge you. You can adjust later in Preferences.',
        highlight: 'Sliders',
        content: (
          <div className="space-y-6">
            {[
              {
                id: 'formality',
                label: 'Formality',
                minLabel: 'Casual',
                maxLabel: 'Polished',
              },
              {
                id: 'depth',
                label: 'Depth',
                minLabel: 'Concise',
                maxLabel: 'Reflective',
              },
              {
                id: 'challenge',
                label: 'Challenge Level',
                minLabel: 'Listener',
                maxLabel: 'Challenger',
              },
            ].map((slider) => {
              const value = data.communicationStyle[slider.id as keyof typeof data.communicationStyle];
              const percentage = (value / 4) * 100;
              const sliderStyle: CSSProperties = {
                // @ts-expect-error custom property
                '--slider-progress': `${percentage}%`,
              };
              return (
                <div key={slider.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">{slider.label}</span>
                    <span className="text-xs text-slate-500">
                      {slider.minLabel} <span className="mx-1 text-slate-300">|</span> {slider.maxLabel}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={4}
                    value={value}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      setData((prev) => ({
                        ...prev,
                        communicationStyle: {
                          ...prev.communicationStyle,
                          [slider.id]: nextValue,
                        },
                      }));
                    }}
                    className="onboarding-slider h-2 w-full appearance-none rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A996F9]"
                    style={sliderStyle}
                  />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{slider.minLabel}</span>
                    <span>{slider.maxLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ),
        nextLabel: 'Next',
      },
      {
        title: 'Help me understand how you think.',
        description: 'Pick anything that resonates — we’ll adapt reasoning style and pacing around you.',
        highlight: 'Cognitive profile',
        content: (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              {COGNITIVE_STYLES.map((style) => {
                const selected = data.cognitiveStyles.includes(style.id);
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() =>
                      setData((prev) => ({
                        ...prev,
                        cognitiveStyles: toggleSelection(prev.cognitiveStyles, style.id),
                      }))
                    }
                    className={cn(
                      'rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A996F9]',
                      selected
                        ? 'border-[#8B76FF] bg-[#F6F3FF] text-[#5230D0]'
                        : 'bg-white hover:border-[#B8A9FF]',
                    )}
                  >
                    {style.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-3">
              <span className="text-sm font-medium text-slate-800">What motivates you most?</span>
              <div className="flex flex-wrap gap-2">
                {MOTIVATION_OPTIONS.map((option) => {
                  const selected = data.motivation === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          motivation: prev.motivation === option ? '' : option,
                        }))
                      }
                      className={cn(
                        'rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A996F9]',
                        selected
                          ? 'border-[#8B76FF] bg-[#8B76FF] text-white shadow-sm'
                          : 'bg-white hover:border-[#B8A9FF]',
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ),
        nextLabel: 'Next',
      },
      {
        title: 'I can remember what matters to you.',
        description: 'Choose how memory behaves. You’re always in control of what stays.',
        highlight: 'Memory preferences',
        content: (
          <div className="grid gap-5 lg:grid-cols-2">
            {[
              {
                id: 'memoryEnabled',
                label: 'Enable memory between sessions',
                description: 'Keep key context so we can build momentum together.',
                checked: data.memoryEnabled,
                onChange: (checked: boolean) =>
                  setData((prev) => ({
                    ...prev,
                    memoryEnabled: checked,
                    forgetAfterSession: checked ? false : prev.forgetAfterSession,
                  })),
              },
              {
                id: 'forgetAfterSession',
                label: 'Forget everything after each session',
                description: 'Start fresh every time — nothing persists once you close the chat.',
                checked: data.forgetAfterSession,
                onChange: (checked: boolean) =>
                  setData((prev) => ({
                    ...prev,
                    forgetAfterSession: checked,
                    memoryEnabled: checked ? false : prev.memoryEnabled,
                  })),
              },
            ].map((toggle) => (
              <label
                key={toggle.id}
                className="group relative flex items-start gap-4 rounded-[26px] border border-slate-200 bg-white/95 p-5 shadow-sm transition-[transform,box-shadow,border] duration-200 hover:-translate-y-[2px] hover:border-[#C8B9FF] hover:shadow-[0_18px_40px_rgba(45,35,95,0.12)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-[#A996F9] motion-reduce:transform-none motion-reduce:shadow-none"
              >
                <input
                  type="checkbox"
                  checked={toggle.checked}
                  onChange={(event) => toggle.onChange(event.target.checked)}
                  className="peer sr-only"
                />
                <div>
                  <span className="text-base font-semibold text-slate-900">{toggle.label}</span>
                  <p className="mt-1 text-sm text-slate-500">{toggle.description}</p>
                </div>
                <span className="ml-auto inline-flex items-center">
                  <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 transition-colors duration-200 peer-checked:bg-[#6F4DEF] motion-reduce:transition-none">
                    <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-5 motion-reduce:transition-none" />
                  </span>
                </span>
              </label>
            ))}
            <div className="lg:col-span-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="memory-notes">
                Add a few things you’d like me to remember:
              </label>
              <textarea
                id="memory-notes"
                value={data.memoryNotes}
                onChange={(event) =>
                  setData((prev) => ({
                    ...prev,
                    memoryNotes: event.target.value,
                  }))
                }
                placeholder="“I’m building a startup”, “I’m studying psychology”, “I prefer shorter summaries.”"
                className="mt-2 w-full min-h-[120px] rounded-[24px] border border-slate-200 bg-white/90 p-4 text-sm text-slate-700 shadow-inner focus:border-[#A996F9] focus:outline-none focus:ring-2 focus:ring-[#A996F9]/30"
              />
            </div>
          </div>
        ),
        nextLabel: 'Next',
      },
      {
        title: 'Would you like to bring context with you?',
        description: 'This primes OptimismAI with the world you’re working in. You can add more later.',
        highlight: 'Optional imports',
        content: (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {IMPORT_OPTIONS.map((option) => {
                const selected = data.importOptions[option.id as keyof typeof data.importOptions];
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setData((prev) => ({
                        ...prev,
                        importOptions: {
                          ...prev.importOptions,
                          [option.id]: !prev.importOptions[option.id as keyof typeof prev.importOptions],
                        },
                      }))
                    }
                  className={cn(
                    'relative flex h-full flex-col rounded-[26px] border border-dashed border-slate-200 bg-white p-5 text-left shadow-sm transition-[transform,box-shadow,border] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A996F9] hover:-translate-y-[2px] hover:border-[#C8B9FF] hover:shadow-[0_18px_45px_rgba(45,35,95,0.12)] motion-reduce:transform-none motion-reduce:shadow-none',
                    selected &&
                      'border border-solid border-[#8B76FF] bg-[#F6F3FF] shadow-[0_25px_60px_rgba(108,89,255,0.16)] ring-4 ring-[#8B76FF1F]',
                    )}
                  >
                    <span className="pointer-events-none absolute -top-3 -left-3 h-12 w-12 rounded-full bg-[radial-gradient(circle,#fceeff_0%,transparent_70%)] opacity-70" />
                    <div className="text-2xl">{option.icon}</div>
                    <h3 className="mt-3 text-base font-semibold text-slate-900">{option.title}</h3>
                    <p className="mt-2 text-sm text-slate-500">{option.description}</p>
                    {selected && <span className="mt-4 text-xs font-semibold text-[#6F4DEF]">Queued</span>}
                  </button>
                );
              })}
            </div>
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/85 p-6 text-center text-sm text-slate-500">
              Upload interactions are mocked for now. Drag files or drop links once integrations are wired — you’ll see a privacy toggle per item.
            </div>
          </div>
        ),
        nextLabel: 'Next',
      },
      {
        title: 'How do you plan to use OptimismAI most often?',
        description: 'Choose a main focus and a supporting role. These shape your default mode and dashboard layout.',
        highlight: 'Primary + secondary',
        content: (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {USE_CASE_OPTIONS.map((option) => {
                const isPrimary = data.useCasePrimary === option.id;
                const isSecondary = data.useCaseSecondary === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setData((prev) => {
                        if (prev.useCasePrimary === option.id) {
                          return { ...prev, useCasePrimary: null };
                        }
                        if (!prev.useCasePrimary) {
                          return { ...prev, useCasePrimary: option.id };
                        }
                        if (prev.useCaseSecondary === option.id) {
                          return { ...prev, useCaseSecondary: null };
                        }
                        return { ...prev, useCaseSecondary: option.id };
                      })
                    }
                    className={cn(
                      'relative flex h-full flex-col rounded-[26px] border border-slate-200 bg-white p-5 text-left shadow-sm transition-[transform,box-shadow,border] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A996F9] hover:-translate-y-[3px] hover:border-[#C8B9FF] hover:shadow-[0_22px_50px_rgba(45,35,95,0.12)] motion-reduce:transform-none motion-reduce:shadow-none',
                      isPrimary &&
                        'border-black bg-black text-white shadow-[0_30px_70px_rgba(0,0,0,0.25)] hover:border-black',
                      !isPrimary && isSecondary && 'border-[#8B76FF] bg-[#F6F3FF] text-slate-900',
                    )}
                  >
                    <div className="text-2xl">{option.icon}</div>
                    <h3 className="mt-3 text-lg font-semibold">{option.title}</h3>
                    <p className="mt-2 text-sm text-slate-400">{option.description}</p>
                    {(isPrimary || isSecondary) && (
                      <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                        <Check size={14} />
                        {isPrimary ? 'Primary focus' : 'Secondary'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-slate-500">
              Tip: click once to set a primary focus. A second selection becomes secondary. Click again to deselect.
            </p>
          </div>
        ),
        nextLabel: 'Next',
      },
      {
        title: 'Your data, your choice.',
        description: 'Granular controls for what’s remembered. Update these anytime in Settings → Privacy.',
        highlight: 'Privacy preferences',
        content: (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                id: 'rememberSummaries',
                title: 'Remember chat summaries automatically',
                description: 'Keep lightweight recaps so it’s easy to resume later.',
              },
              {
                id: 'syncAcrossDevices',
                title: 'Sync across devices',
                description: 'Stay in sync wherever you sign in to OptimismAI.',
              },
              {
                id: 'allowDeletion',
                title: 'Allow me to delete all data anytime',
                description: 'One tap to purge our history completely.',
              },
              {
                id: 'collectiveInsights',
                title: 'Participate in collective insights (optional, anonymized)',
                description: 'Help improve OptimismAI for everyone — anonymously.',
              },
            ].map((toggle) => {
              const checked = data.privacy[toggle.id as keyof typeof data.privacy];
              return (
                <label
                  key={toggle.id}
                  className="group relative flex items-start gap-4 rounded-[26px] border border-slate-200 bg-white/95 p-5 shadow-sm transition-[transform,box-shadow,border] duration-200 hover:-translate-y-[2px] hover:border-[#C8B9FF] hover:shadow-[0_18px_40px_rgba(45,35,95,0.12)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-[#A996F9] motion-reduce:transform-none motion-reduce:shadow-none"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        privacy: {
                          ...prev.privacy,
                          [toggle.id]: event.target.checked,
                        },
                      }))
                    }
                    className="peer sr-only"
                  />
                  <div>
                    <span className="text-base font-semibold text-slate-900">{toggle.title}</span>
                    <p className="mt-1 text-sm text-slate-500">{toggle.description}</p>
                  </div>
                  <span className="ml-auto inline-flex items-center">
                    <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 transition-colors duration-200 peer-checked:bg-[#6F4DEF] motion-reduce:transition-none">
                      <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-5 motion-reduce:transition-none" />
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ),
        nextLabel: 'Next',
      },
      {
        title: 'Let’s give your Lens a touch of personality.',
        description: 'How should I greet you, and what vibe should your space take on?',
        highlight: 'Personalisation',
        content: (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <div className="space-y-4 rounded-[26px] border border-slate-200 bg-white/95 p-5 shadow-sm">
              <label className="text-sm font-medium text-slate-800" htmlFor="display-name">
                What should I call you?
              </label>
              <Input
                id="display-name"
                placeholder="Your name"
                value={data.displayName}
                onChange={(event) => setData((prev) => ({ ...prev, displayName: event.target.value }))}
                className="rounded-[18px] border-slate-200 bg-white text-slate-800 focus:border-[#A996F9] focus:ring-[#A996F9]/30"
              />
              <label className="text-sm font-medium text-slate-800" htmlFor="ai-nickname">
                Would you like to name your OptimismAI?
              </label>
              <Input
                id="ai-nickname"
                placeholder="Give your guide a nickname"
                value={data.aiNickname}
                onChange={(event) => setData((prev) => ({ ...prev, aiNickname: event.target.value }))}
                className="rounded-[18px] border-slate-200 bg-white text-slate-800 focus:border-[#A996F9] focus:ring-[#A996F9]/30"
              />
              <label className="text-sm font-medium text-slate-800" htmlFor="voice-select">
                Choose a voice (optional)
              </label>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <select
                  id="voice-select"
                  value={data.voice}
                  onChange={(event) => setData((prev) => ({ ...prev, voice: event.target.value }))}
                  className="flex-1 rounded-[18px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#A996F9] focus:outline-none focus:ring-2 focus:ring-[#A996F9]/30"
                >
                  {VOICE_OPTIONS.map((voice) => (
                    <option key={voice} value={voice}>
                      {voice}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setPreviewVoice(data.voice)}
                  className={secondaryButtonClass}
                >
                  <Volume2 size={16} />
                  Preview
                </button>
              </div>
              {previewVoice && (
                <p className="text-xs text-slate-500">
                  Playing preview:&nbsp;
                  <span className="font-medium text-slate-800">{previewVoice}</span>
                </p>
              )}
            </div>
            <div className="space-y-4 rounded-[26px] border border-slate-200 bg-white/95 p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-800">Pick your theme colour</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {THEME_CHOICES.map((choice) => {
                  const selected = data.theme === choice.id;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => handleThemeSelect(choice.id)}
                      className={cn(
                        'flex items-center justify-between rounded-[22px] border border-slate-200 bg-white p-4 text-left transition-[transform,box-shadow,border] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A996F9] hover:-translate-y-[2px] hover:border-[#C8B9FF] hover:shadow-[0_16px_36px_rgba(45,35,95,0.1)] motion-reduce:transform-none motion-reduce:shadow-none',
                        selected && 'border-[#8B76FF] shadow-[0_20px_45px_rgba(108,89,255,0.18)]',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'h-10 w-10 rounded-full border border-white/40 shadow-inner',
                            `bg-gradient-to-br ${choice.gradient}`,
                          )}
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{choice.label}</p>
                          <p className="text-xs text-slate-500">{choice.description}</p>
                        </div>
                      </div>
                      {selected && (
                        <span className="text-xs font-semibold uppercase tracking-wide text-[#6F4DEF]">Selected</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ),
        nextLabel: 'Next',
      },
      {
        title: 'Calibrate your Optimist’s Lens.',
        description:
          'Balance optimism with clarity. This doesn’t lock you in — it just sets a starting point you can adjust anytime.',
        highlight: 'Lens balance',
        content: (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-white p-8 shadow-[0_35px_90px_rgba(45,35,95,0.1)]">
              <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#f2e6ff_0%,transparent_70%),radial-gradient(circle_at_bottom,#ffe7dc_0%,transparent_75%)] opacity-90" />
              <div className="relative flex flex-col items-start gap-4 text-left">
                <AnimatedOrb
                  hue={data.lensBalance < 50 ? 310 : 40}
                  glow={0.8}
                  activityLevel={prefersReducedMotion ? 0.1 : 0.3}
                  className="w-[160px]"
                  style={{ filter: 'drop-shadow(0 25px 40px rgba(218, 189, 255, 0.4))' }}
                />
                <span className="rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 backdrop-blur">
                  {getLensLabel(data.lensBalance)}
                </span>
                <p className="text-sm text-slate-500">
                  Slide to choose where your lens begins. Optimism encourages ideation; reality keeps us grounded.
                </p>
              </div>
            </div>
            <div className="space-y-5 rounded-[26px] border border-slate-200 bg-white/95 p-6 shadow-sm">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>Optimism</span>
                <span>Reality</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={data.lensBalance}
                onChange={(event) =>
                  setData((prev) => ({
                    ...prev,
                    lensBalance: Number(event.target.value),
                  }))
                }
                className="onboarding-slider h-2 w-full appearance-none rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A996F9]"
                style={
                  {
                    // @ts-expect-error custom property
                    '--slider-progress': `${data.lensBalance}%`,
                  } as CSSProperties
                }
              />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{Math.round(data.lensBalance)}% optimism</span>
                <span>{Math.round(100 - data.lensBalance)}% clarity</span>
              </div>
            </div>
          </div>
        ),
        nextLabel: 'Next',
      },
      {
        title: 'You’re ready to begin.',
        description: 'Here’s a quick summary. You can revisit everything later in Settings.',
        highlight: 'Summary',
        showNext: false,
        content: (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  title: 'Mode',
                  body:
                    data.useCasePrimary
                      ? USE_CASE_OPTIONS.find((option) => option.id === data.useCasePrimary)?.title ??
                        'Custom blend'
                      : 'Exploring possibilities',
                },
                {
                  title: 'Tone & Interaction',
                  body: `Formality ${data.communicationStyle.formality + 1}/5 • Depth ${
                    data.communicationStyle.depth + 1
                  }/5 • Challenge ${data.communicationStyle.challenge + 1}/5`,
                },
                {
                  title: 'Memory',
                  body: data.memoryEnabled
                    ? 'Keeps context between sessions.'
                    : data.forgetAfterSession
                      ? 'Resets after each conversation.'
                      : 'Decide later.',
                },
                {
                  title: 'Privacy',
                  body: [
                    data.privacy.rememberSummaries ? 'Auto summaries' : 'Summaries off',
                    data.privacy.syncAcrossDevices ? 'Sync on' : 'Local only',
                    data.privacy.allowDeletion ? 'Instant wipe enabled' : 'Ask before deleting',
                  ].join(' • '),
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[26px] border border-slate-200 bg-white/95 p-5 shadow-sm"
                >
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-500">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_30px_70px_rgba(45,35,95,0.1)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Lens calibration
                  </p>
                  <p className="text-2xl font-semibold text-slate-900">{getLensLabel(data.lensBalance)}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {Math.round(data.lensBalance)}% optimism • {Math.round(100 - data.lensBalance)}% clarity
                  </p>
                </div>
                <AnimatedOrb
                  hue={320}
                  glow={0.6}
                  activityLevel={prefersReducedMotion ? 0.05 : 0.25}
                  className="mx-auto w-[140px]"
                  style={{ filter: 'drop-shadow(0 20px 40px rgba(210, 190, 255, 0.4))' }}
                />
              </div>
            </div>
          </div>
        ),
      },
    ],
    [data, handleThemeSelect, prefersReducedMotion, previewVoice],
  );

  const totalSteps = screenConfigs.length;

  useEffect(() => {
    setStep((prev) => Math.min(prev, totalSteps - 1));
  }, [totalSteps]);

  const progress = useMemo(() => ((step + 1) / totalSteps) * 100, [step, totalSteps]);

  const nextStep = useCallback(() => {
    setStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [totalSteps]);

  const prevStep = useCallback(() => {
    setStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleBegin = useCallback(async () => {
    setIsCompleting(true);

    const delay = prefersReducedMotion ? 150 : 450;

    try {
      await new Promise((resolve) => setTimeout(resolve, delay));
      await Promise.resolve(onComplete());
    } catch (error) {
      console.error('[onboarding] Failed to complete onboarding', error);
      setIsCompleting(false);
    }
  }, [onComplete, prefersReducedMotion]);

  const currentScreen = screenConfigs[step];
  const isFinalStep = step === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[2200] flex min-h-screen flex-col items-center justify-center overflow-y-auto bg-white px-4 py-10 text-left">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#f3e6ff4d_0%,transparent_60%),radial-gradient(circle_at_bottom,#ffe8dc66_0%,transparent_55%)]" />
      <div
        className={cn(
          'relative w-full max-w-5xl rounded-[32px] border border-white/70 bg-white/95 shadow-[0_45px_110px_rgba(35,30,70,0.12)] backdrop-blur-xl transition-[opacity,transform,filter] duration-500 ease-out',
          isCompleting &&
            (prefersReducedMotion ? 'opacity-0' : 'opacity-0 blur-sm translate-y-3'),
        )}
      >
        <div className="flex flex-col gap-8 p-8 md:p-10">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Step {step + 1} of {totalSteps}
              </div>
              {currentScreen.highlight && (
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                  <span className="size-2 rounded-full bg-[#bfa5ff]" />
                  {currentScreen.highlight}
                </div>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
              <div
                className="h-full rounded-full bg-[#6F4DEF] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
            {currentScreen.title && (
              <div className="space-y-3">
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{currentScreen.title}</h2>
                {currentScreen.description && (
                  <p className="max-w-3xl text-base text-slate-600">{currentScreen.description}</p>
                )}
              </div>
            )}
          </div>

          <div className="min-h-[400px]">{currentScreen.content}</div>

          <footer className="flex flex-col gap-4 border-t border-white/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-slate-400">
              You can refine any of this later in Settings → Support → Guided Tour.
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {(!isFinalStep && step > 0) || isFinalStep ? (
                <button type="button" onClick={prevStep} className={secondaryButtonClass} disabled={step === 0}>
                  <ChevronLeft size={16} />
                  Back
                </button>
              ) : null}
              {isFinalStep ? (
                <button type="button" onClick={handleBegin} className={primaryButtonClass}>
                  Begin Conversation
                </button>
              ) : (
                currentScreen.showNext !== false && (
                  <button
                    type="button"
                    onClick={nextStep}
                    className={primaryButtonClass}
                    disabled={currentScreen.nextDisabled}
                  >
                    {currentScreen.nextLabel ?? 'Next'}
                    <ChevronRight size={16} />
                  </button>
                )
              )}
            </div>
          </footer>
        </div>
      </div>
      <div
        className={cn(
          'fixed inset-0 z-[2250] flex items-center justify-center bg-white/60 backdrop-blur-md transition-opacity duration-500 ease-out motion-reduce:transition-none pointer-events-none opacity-0',
          isCompleting && 'pointer-events-auto opacity-100',
        )}
      >
        <div className="flex flex-col items-center gap-6 text-center">
          <AnimatedOrb
            hue={320}
            glow={0.7}
            activityLevel={prefersReducedMotion ? 0.05 : 0.25}
            className="w-[150px]"
            style={{ filter: 'drop-shadow(0 25px 50px rgba(210, 190, 255, 0.4))' }}
          />
          <div className="space-y-1">
            <p className="text-base font-medium text-slate-800">Tuning your Lens…</p>
            <p className="text-sm text-slate-500">Bringing your workspace to life.</p>
          </div>
        </div>
      </div>
      <style>
        {`
        .onboarding-slider {
          --slider-track: #e7e9f2;
          --slider-active: ${BRAND_VIOLET};
          background: linear-gradient(
            to right,
            var(--slider-active) 0%,
            var(--slider-active) var(--slider-progress),
            var(--slider-track) var(--slider-progress),
            var(--slider-track) 100%
          );
          height: 0.6rem;
        }
        .onboarding-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 999px;
          background: ${BRAND_INK};
          border: 3px solid #ffffff;
          box-shadow: 0 6px 14px rgba(30, 20, 70, 0.18);
          cursor: pointer;
        }
        .onboarding-slider::-moz-range-thumb {
          height: 18px;
          width: 18px;
          border-radius: 999px;
          background: ${BRAND_INK};
          border: 3px solid #ffffff;
          box-shadow: 0 6px 14px rgba(30, 20, 70, 0.18);
          cursor: pointer;
        }
        `}
      </style>
    </div>
  );
}

