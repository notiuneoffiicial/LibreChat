import { useEffect, useMemo, useState } from 'react';
import { Button, Input } from '@librechat/client';
import { Volume2, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import AnimatedOrb from './AnimatedOrb';
import { cn } from '~/utils';

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

const TOTAL_STEPS = 12;

const PURPOSE_OPTIONS = [
  {
    id: 'personal-growth',
    title: 'Personal Growth',
    description: 'Reflection, mindset, emotional support',
    icon: '🌱',
  },
  {
    id: 'creative-exploration',
    title: 'Creative Exploration',
    description: 'Ideas, writing, brainstorming',
    icon: '💡',
  },
  {
    id: 'professional-reasoning',
    title: 'Professional Reasoning',
    description: 'Decision support, clarity, logic',
    icon: '⚙️',
  },
  {
    id: 'philosophical-inquiry',
    title: 'Philosophical Inquiry',
    description: 'Meaning, purpose, curiosity',
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
    description: 'Let me reference visual material or whiteboard sketches.',
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
    description: 'Store and retrieve insights, keep projects organized.',
    icon: '🧠',
  },
];

const THEME_CHOICES: { id: ThemeChoice; label: string; description: string; gradient: string }[] = [
  {
    id: 'warm-amber',
    label: 'Warm Amber',
    description: 'Empathy & encouragement',
    gradient: 'from-amber-300 via-orange-200 to-amber-100',
  },
  {
    id: 'cool-teal',
    label: 'Cool Teal',
    description: 'Clarity & calm focus',
    gradient: 'from-teal-400 via-cyan-300 to-sky-200',
  },
  {
    id: 'rose-quartz',
    label: 'Rose Quartz',
    description: 'Gentleness & compassion',
    gradient: 'from-rose-300 via-pink-200 to-rose-100',
  },
  {
    id: 'graphite',
    label: 'Graphite',
    description: 'Minimal, understated',
    gradient: 'from-slate-700 via-slate-800 to-slate-900',
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
  customFooter?: React.ReactNode;
}

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [previewVoice, setPreviewVoice] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData>(initialState);

  useEffect(() => {
    if (!previewVoice) {
      return;
    }
    const timeout = setTimeout(() => setPreviewVoice(null), 1500);
    return () => clearTimeout(timeout);
  }, [previewVoice]);

  const progress = useMemo(() => ((step + 1) / TOTAL_STEPS) * 100, [step]);

  const nextStep = () => {
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleThemeSelect = (choice: ThemeChoice) => {
    setData((prev) => ({ ...prev, theme: choice }));
  };

  const screenConfigs: ScreenConfig[] = [
    {
      content: (
        <div className="flex h-full flex-col items-center justify-center gap-10 text-center">
          <AnimatedOrb
            hue={320}
            glow={1.2}
            style={{ width: '220px', height: '220px', filter: 'drop-shadow(0 25px 45px rgba(238, 161, 197, 0.45))' }}
          />
          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-white drop-shadow-lg">
              Welcome to OptimismAI.
            </h1>
            <p className="text-lg text-white/90">
              Before we begin, let’s tune your lens — so I can meet you where you are.
            </p>
            <p className="text-sm text-white/80">It only takes a minute.</p>
          </div>
        </div>
      ),
      nextLabel: 'Start',
    },
    {
      title: 'What brings you to OptimismAI today?',
      description:
        'Choose anything that resonates. We’ll shape your default model and cadence around what matters most right now.',
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
                  'flex h-full flex-col rounded-2xl border p-5 text-left transition-all duration-200',
                  selected ? 'border-primary bg-primary/10 shadow-lg' : 'border-border/50 bg-surface-primary',
                  'hover:border-primary hover:shadow-xl',
                )}
              >
                <div className="mb-3 text-3xl">{option.icon}</div>
                <h3 className="text-lg font-semibold text-text-primary">{option.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">{option.description}</p>
                {selected && (
                  <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
                    <Check size={16} />
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
      description: 'Set the tone, depth, and engagement style that feels natural to you.',
      content: (
        <div className="space-y-6">
          {[
            {
              id: 'formality',
              label: 'Formality',
              minLabel: 'Casual',
              maxLabel: 'Formal',
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
          ].map((slider) => (
            <div key={slider.id} className="space-y-3">
              <div className="flex items-center justify-between text-sm font-medium text-text-primary">
                <span>{slider.label}</span>
                <span className="text-xs text-text-secondary">
                  {slider.minLabel} <span className="mx-1 text-text-tertiary">|</span> {slider.maxLabel}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={4}
                value={data.communicationStyle[slider.id as keyof typeof data.communicationStyle]}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setData((prev) => ({
                    ...prev,
                    communicationStyle: {
                      ...prev.communicationStyle,
                      [slider.id]: value,
                    },
                  }));
                }}
                className="h-2 w-full rounded-full bg-muted accent-primary"
              />
              <div className="flex justify-between text-xs text-text-tertiary">
                <span>{slider.minLabel}</span>
                <span>{slider.maxLabel}</span>
              </div>
            </div>
          ))}
        </div>
      ),
      nextLabel: 'Next',
    },
    {
      title: 'Help me understand how you think.',
      description: 'Pick anything that resonates — we’ll adapt my reasoning style around you.',
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
                    'rounded-full border px-4 py-2 text-sm transition',
                    selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface-primary',
                  )}
                >
                  {style.label}
                </button>
              );
            })}
          </div>
          <div className="space-y-3">
            <span className="text-sm font-medium text-text-primary">What motivates you most?</span>
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
                      'rounded-full border px-4 py-2 text-sm transition',
                      selected ? 'border-primary bg-primary text-white' : 'border-border bg-surface-primary',
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
      description:
        'Your goals, preferences, and past insights help me stay grounded. You’re always in control of what stays.',
      content: (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border/60 bg-surface-primary p-4 transition hover:border-primary">
              <div>
                <span className="font-medium text-text-primary">Enable memory between sessions</span>
                <p className="text-sm text-text-secondary">Keep important context so we can build momentum.</p>
              </div>
              <input
                type="checkbox"
                checked={data.memoryEnabled}
                onChange={(event) =>
                  setData((prev) => ({
                    ...prev,
                    memoryEnabled: event.target.checked,
                    forgetAfterSession: event.target.checked ? false : true,
                  }))
                }
                className="size-5"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border/60 bg-surface-primary p-4 transition hover:border-primary">
              <div>
                <span className="font-medium text-text-primary">Forget everything after each session</span>
                <p className="text-sm text-text-secondary">Start fresh every time we talk.</p>
              </div>
              <input
                type="checkbox"
                checked={data.forgetAfterSession}
                onChange={(event) =>
                  setData((prev) => ({
                    ...prev,
                    forgetAfterSession: event.target.checked,
                    memoryEnabled: event.target.checked ? false : prev.memoryEnabled,
                  }))
                }
                className="size-5"
              />
            </label>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="memory-notes">
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
              placeholder="“I’m building a startup”, “I’m studying psychology”"
              className="w-full min-h-[120px] rounded-2xl border border-border/60 bg-background/90 p-4 text-sm text-text-primary shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      ),
      nextLabel: 'Next',
    },
    {
      title: 'Would you like to bring context with you?',
      description: 'This helps me understand your world faster. You can always add more later.',
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
                    'flex h-full flex-col rounded-2xl border p-4 text-left transition',
                    selected ? 'border-primary bg-primary/10 shadow-lg' : 'border-border bg-surface-primary',
                  )}
                >
                  <div className="text-2xl">{option.icon}</div>
                  <h3 className="mt-3 text-base font-semibold text-text-primary">{option.title}</h3>
                  <p className="mt-2 text-sm text-text-secondary">{option.description}</p>
                  {selected && <span className="mt-4 text-xs font-medium text-primary">Queued</span>}
                </button>
              );
            })}
          </div>
          <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-text-secondary">
            Uploads and imports are mocked for now — we’ll prompt you here once integrations are wired.
          </div>
        </div>
      ),
      nextLabel: 'Next',
    },
    {
      title: 'How do you plan to use OptimismAI most often?',
      description: 'Choose a main focus and a supporting role. We’ll set your default mode and dashboard layout.',
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
                    'flex h-full flex-col rounded-2xl border p-5 text-left transition duration-200',
                    isPrimary
                      ? 'border-primary bg-primary text-white shadow-lg'
                      : isSecondary
                        ? 'border-primary/60 bg-primary/10 text-text-primary shadow'
                        : 'border-border bg-surface-primary text-text-primary',
                  )}
                >
                  <div className="text-2xl">{option.icon}</div>
                  <h3 className="mt-3 text-lg font-semibold">{option.title}</h3>
                  <p className="mt-2 text-sm text-text-secondary">{option.description}</p>
                  {(isPrimary || isSecondary) && (
                    <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                      <Check size={14} />
                      {isPrimary ? 'Primary' : 'Secondary'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-text-tertiary">
            Tip: click once to make something primary, and again to remove it. A second selection becomes your secondary focus.
          </p>
        </div>
      ),
      nextLabel: 'Next',
    },
    {
      title: 'Your data, your choice.',
      description: 'These controls apply even after onboarding — you can revisit them anytime in Settings.',
      content: (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              id: 'rememberSummaries',
              title: 'Remember chat summaries automatically',
              description: 'Keep session recaps so it’s easy to pick up next time.',
            },
            {
              id: 'syncAcrossDevices',
              title: 'Sync across devices',
              description: 'Access your lens from anywhere you sign in.',
            },
            {
              id: 'allowDeletion',
              title: 'Allow me to delete all data anytime',
              description: 'One tap to purge our history, guaranteed.',
            },
            {
              id: 'collectiveInsights',
              title: 'Participate in collective insights (optional, anonymized)',
              description: 'Help make OptimismAI smarter for everyone — anonymously.',
            },
          ].map((toggle) => {
            const checked = data.privacy[toggle.id as keyof typeof data.privacy];
            return (
              <label
                key={toggle.id}
                className="flex cursor-pointer items-center justify-between rounded-2xl border border-border/60 bg-surface-primary p-4 transition hover:border-primary"
              >
                <div>
                  <span className="font-medium text-text-primary">{toggle.title}</span>
                  <p className="text-sm text-text-secondary">{toggle.description}</p>
                </div>
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
                  className="size-5"
                />
              </label>
            );
          })}
        </div>
      ),
      nextLabel: 'Next',
    },
    {
      title: 'Let’s give your Lens a touch of personality.',
      description: 'Tune how I greet you, and choose a palette that feels like home.',
      content: (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-border/60 bg-surface-primary p-4">
            <label className="text-sm font-medium text-text-primary" htmlFor="display-name">
              What should I call you?
            </label>
            <Input
              id="display-name"
              placeholder="Your name"
              value={data.displayName}
              onChange={(event) => setData((prev) => ({ ...prev, displayName: event.target.value }))}
            />
            <label className="text-sm font-medium text-text-primary" htmlFor="ai-nickname">
              Would you like to name your OptimismAI?
            </label>
            <Input
              id="ai-nickname"
              placeholder="Give your guide a nickname"
              value={data.aiNickname}
              onChange={(event) => setData((prev) => ({ ...prev, aiNickname: event.target.value }))}
            />
            <label className="text-sm font-medium text-text-primary" htmlFor="voice-select">
              Choose a voice (optional)
            </label>
            <div className="flex items-center gap-3">
              <select
                id="voice-select"
                value={data.voice}
                onChange={(event) => setData((prev) => ({ ...prev, voice: event.target.value }))}
                className="flex-1 rounded-lg border border-border/60 bg-background/90 p-2 text-sm"
              >
                {VOICE_OPTIONS.map((voice) => (
                  <option key={voice} value={voice}>
                    {voice}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPreviewVoice(data.voice)}
                className="flex items-center gap-2"
              >
                <Volume2 size={16} />
                Preview
              </Button>
            </div>
            {previewVoice && (
              <p className="text-xs text-text-tertiary">
                Playing preview: <span className="font-medium text-text-primary">{previewVoice}</span>
              </p>
            )}
          </div>
          <div className="space-y-4 rounded-2xl border border-border/60 bg-surface-primary p-4">
            <p className="text-sm font-medium text-text-primary">Pick your theme color</p>
            <div className="grid gap-3">
              {THEME_CHOICES.map((choice) => {
                const selected = data.theme === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => handleThemeSelect(choice.id)}
                    className={cn(
                      'flex items-center justify-between rounded-2xl border p-4 transition',
                      selected ? 'border-primary shadow-lg' : 'border-border',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'h-10 w-10 rounded-full border border-white/30',
                          `bg-gradient-to-br ${choice.gradient}`,
                        )}
                      ></span>
                      <div className="text-left">
                        <p className="font-semibold text-text-primary">{choice.label}</p>
                        <p className="text-xs text-text-secondary">{choice.description}</p>
                      </div>
                    </div>
                    {selected && <Check className="text-primary" size={18} />}
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
      title: 'Find your optimism-reality balance.',
      description: 'You can always adjust this later — it just sets our starting point.',
      content: (
        <div className="space-y-6">
          <div className="relative flex h-52 flex-col items-center justify-center rounded-3xl bg-gradient-to-r from-amber-200 via-white to-sky-200 p-6 shadow-inner">
            <div className="text-sm font-medium text-text-primary">{getLensLabel(data.lensBalance)}</div>
            <div className="mt-2 text-4xl font-semibold text-text-primary">
              {data.lensBalance}% optimism <span className="text-text-tertiary">/</span> {100 - data.lensBalance}% reality
            </div>
            <p className="mt-4 max-w-md text-center text-sm text-text-secondary">
              Slide to adjust how much optimism or grounded clarity you’d like me to lead with.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-medium text-text-tertiary">
              <span>🟡 Optimism</span>
              <span>🔵 Reality</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={data.lensBalance}
              onChange={(event) => setData((prev) => ({ ...prev, lensBalance: Number(event.target.value) }))}
              className="h-3 w-full rounded-full bg-muted accent-primary"
            />
          </div>
        </div>
      ),
      nextLabel: 'Next',
    },
    {
      title: 'You’re ready to begin.',
      description: 'Here’s a quick snapshot of the lens we tuned together.',
      content: (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-surface-primary p-4">
              <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wide">Mode</h3>
              <p className="mt-2 text-lg font-semibold text-text-primary">
                {data.useCasePrimary ? USE_CASE_OPTIONS.find((option) => option.id === data.useCasePrimary)?.title ?? 'Reflective Guide' : 'Reflective Guide'}
              </p>
              <p className="mt-2 text-sm text-text-secondary">
                {data.purposes.length
                  ? data.purposes
                      .map((id) => PURPOSE_OPTIONS.find((option) => option.id === id)?.title ?? '')
                      .filter(Boolean)
                      .join(', ')
                  : 'We’ll explore together.'}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-surface-primary p-4">
              <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wide">Tone & Interaction</h3>
              <p className="mt-2 text-sm text-text-secondary">
                Formality: {data.communicationStyle.formality + 1} / 5<br />
                Depth: {data.communicationStyle.depth + 1} / 5<br />
                Challenge: {data.communicationStyle.challenge + 1} / 5
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-surface-primary p-4">
              <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wide">Memory</h3>
              <p className="mt-2 text-sm text-text-secondary">
                {data.memoryEnabled ? 'Enabled between sessions' : 'Disabled — we’ll start fresh each time.'}
              </p>
              {data.memoryNotes && (
                <p className="mt-2 text-sm text-text-primary">
                  <span className="font-medium text-text-secondary">Notes:</span> {data.memoryNotes}
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-border/60 bg-surface-primary p-4">
              <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wide">Privacy</h3>
              <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                <li>{data.privacy.rememberSummaries ? '• Remember summaries' : '• No automatic summaries'}</li>
                <li>{data.privacy.syncAcrossDevices ? '• Sync enabled' : '• Sync off'}</li>
                <li>{data.privacy.allowDeletion ? '• Quick-delete availability' : '• Manual deletion only'}</li>
                <li>
                  {data.privacy.collectiveInsights
                    ? '• Contributing to collective insights'
                    : '• Personal lens only'}
                </li>
              </ul>
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-surface-primary p-4">
            <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wide">Lens Calibration</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Starting at{' '}
              <span className="font-semibold text-text-primary">
                {data.lensBalance}% optimism / {100 - data.lensBalance}% reality
              </span>
              . You can adjust this anytime.
            </p>
          </div>
        </div>
      ),
      nextLabel: 'Begin Conversation',
    },
    {
      content: (
        <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
          <AnimatedOrb
            hue={data.theme === 'graphite' ? 210 : data.theme === 'cool-teal' ? 190 : data.theme === 'rose-quartz' ? 330 : 45}
            glow={1.4}
            activityLevel={0.6}
            style={{
              width: '260px',
              height: '260px',
              filter: 'drop-shadow(0 35px 65px rgba(255, 255, 255, 0.15))',
            }}
          />
          <div className="max-w-xl space-y-4">
            <p className="text-2xl font-semibold text-text-primary">Tuning your Lens… done.</p>
            <p className="text-text-secondary">
              {data.displayName ? `Hello ${data.displayName}, ` : 'Hello, '}
              {data.aiNickname ? `I’m ${data.aiNickname}. ` : ''}
              I’m ready when you are.
            </p>
          </div>
        </div>
      ),
      showNext: false,
      customFooter: (
        <div className="mt-8 flex items-center justify-end">
          <Button
            type="button"
            className="flex items-center gap-2"
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.setItem('OPTIMISM_ONBOARDING_COMPLETED', 'true');
              }
              onComplete();
            }}
          >
            Begin
            <ChevronRight size={18} />
          </Button>
        </div>
      ),
    },
  ];

  const screen = screenConfigs[step];

  return (
    <div className="fixed inset-0 z-[2200] flex min-h-screen flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-[#DA76EA] via-[#EFB4AC] to-[#F2D5C3] px-4 py-10 text-left">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#E69AE855_0%,transparent_55%),radial-gradient(circle_at_bottom,#F4D4C755_0%,transparent_50%)]" />
      <div className="relative z-10 w-full max-w-4xl rounded-3xl border border-white/10 bg-surface-primary/85 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-text-tertiary">Optimist’s Lens Setup</p>
              <h2 className="mt-2 text-3xl font-semibold text-text-primary">
                {screen.title ?? 'Welcome'}
              </h2>
              {screen.description && <p className="mt-2 text-sm text-text-secondary">{screen.description}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-text-secondary">
                Step <span className="text-text-primary">{step + 1}</span> of {TOTAL_STEPS}
              </p>
              <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-border/60">
                <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>
        <div className="h-[430px] overflow-y-auto rounded-2xl border border-border/40 bg-background/80 p-6 shadow-inner">
          {screen.content}
        </div>
        {screen.showNext !== false && (
          <div className="mt-6 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={prevStep}
              className={cn('flex items-center gap-2', step === 0 && 'invisible')}
            >
              <ChevronLeft size={18} />
              Back
            </Button>
            <Button type="button" onClick={screenConfigs[step].nextLabel === 'Begin Conversation' ? () => setStep(step + 1) : nextStep} disabled={screen.nextDisabled}>
              {screen.nextLabel ?? 'Next'}
              <ChevronRight className="ml-2" size={18} />
            </Button>
          </div>
        )}
        {screen.customFooter}
      </div>
    </div>
  );
}

