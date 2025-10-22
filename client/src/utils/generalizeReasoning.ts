const DEFAULT_STATEMENTS = [
  'Internally reflecting on the request before responding.',
];

type ReasoningCategory = {
  summary: string;
  patterns: RegExp[];
};

const CATEGORIES: ReasoningCategory[] = [
  {
    summary: "Clarifying the user's intent and goals.",
    patterns: [
      /\bintent\b/i,
      /\bgoal\b/i,
      /\buser(?:'s)?\b/i,
      /\bquestion\b/i,
      /\brequest\b/i,
    ],
  },
  {
    summary: 'Reviewing conversation context and relevant details.',
    patterns: [
      /\bcontext\b/i,
      /\bhistory\b/i,
      /\bprevious\b/i,
      /\bconversation\b/i,
      /\bprior\b/i,
    ],
  },
  {
    summary: 'Evaluating knowledge sources or references that could help.',
    patterns: [
      /\bknowledge\b/i,
      /\binformation\b/i,
      /\bfacts?\b/i,
      /\bresearch\b/i,
      /\bweb\b/i,
      /\bsearch\b/i,
      /\bbrowse\b/i,
      /\bsources?\b/i,
    ],
  },
  {
    summary: 'Considering whether tools or functions are required.',
    patterns: [
      /\btool\b/i,
      /\bfunction\b/i,
      /\bapi\b/i,
      /\bplugin\b/i,
      /\bcommand\b/i,
      /\baction\b/i,
      /\bcall\b/i,
    ],
  },
  {
    summary: 'Checking the response against policies and safety guidelines.',
    patterns: [
      /\bsafety\b/i,
      /\bpolicy\b/i,
      /\bguideline\b/i,
      /\brestrict\b/i,
      /\ballowed\b/i,
      /\bdisallow\b/i,
      /\bcompli(?:ant|ance)\b/i,
    ],
  },
  {
    summary: 'Mapping out the structure of the forthcoming answer.',
    patterns: [
      /\bplan\b/i,
      /\bapproach\b/i,
      /\boutline\b/i,
      /\bstructure\b/i,
      /\bformat\b/i,
      /\borganize\b/i,
    ],
  },
  {
    summary: 'Weighing options and reasoning through possible solutions.',
    patterns: [
      /\banaly(?:s|z)e\b/i,
      /\bconsider\b/i,
      /\bevaluate\b/i,
      /\bcompare\b/i,
      /\bassess\b/i,
      /\boption\b/i,
      /\btrade[-\s]?off\b/i,
    ],
  },
  {
    summary: 'Preparing to articulate the final response clearly.',
    patterns: [
      /\bfinal\b/i,
      /\brespond\b/i,
      /\banswer\b/i,
      /\bexplain\b/i,
      /\bsummarize\b/i,
      /\bconclude\b/i,
      /\bdeliver\b/i,
      /\bcompose\b/i,
      /\bwrite\b/i,
    ],
  },
  {
    summary: 'Working through quantitative or mathematical details internally.',
    patterns: [
      /\bcalculate\b/i,
      /\bcompute\b/i,
      /\bmath\b/i,
      /\bequation\b/i,
      /\bformula\b/i,
      /\bnumber\b/i,
    ],
  },
  {
    summary: 'Reasoning about code behavior or implementation specifics.',
    patterns: [
      /\bcode\b/i,
      /\bdebug\b/i,
      /\bfunction\b/i,
      /\bclass\b/i,
      /\bmodule\b/i,
      /\balgorithm\b/i,
      /\bimplementation\b/i,
      /\bbug\b/i,
    ],
  },
];

const STRUCTURE_PATTERNS: RegExp[] = [
  /\n\s*\d+\./, // numbered lists
  /\n\s*(?:[-*]|\u2022)/, // bullet lists
  /\bstep\b/i,
];

const MAX_STATEMENTS = 6;

export const generalizeReasoning = (raw: string): string[] => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  const normalized = trimmed.toLowerCase();
  const summaries = new Set<string>(DEFAULT_STATEMENTS);

  CATEGORIES.forEach(({ summary, patterns }) => {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      summaries.add(summary);
    }
  });

  if (STRUCTURE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    summaries.add('Organizing the approach into structured steps.');
  }

  const result = Array.from(summaries).slice(0, MAX_STATEMENTS);

  if (result.length === 0) {
    return ['Reviewing the request to determine the best path forward.'];
  }

  return result;
};

export default generalizeReasoning;
