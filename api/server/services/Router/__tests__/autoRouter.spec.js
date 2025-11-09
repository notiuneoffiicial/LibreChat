jest.mock('librechat-data-provider', () => ({
  parseCompactConvo: ({ conversation }) => ({ ...conversation }),
  removeNullishValues: (obj) => {
    const result = {};
    Object.entries(obj || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        result[key] = value;
      }
    });
    return result;
  },
  Tools: { web_search: 'web_search' },
}), { virtual: true });

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}), { virtual: true });

const { applyAutoRouting } = require('../autoRouter');
const { resetGauge } = require('../intentGauge');
const { logger } = require('@librechat/data-schemas');

const baseDate = new Date().toISOString();

const createSpec = (name, model = 'deepseek-chat') => ({
  name,
  label: name,
  preset: {
    endpoint: 'Deepseek',
    model,
    modelLabel: 'OptimismAI',
    promptPrefix: `${name} instructions`,
  },
});

const specList = [
  createSpec('optimism_companion'),
  createSpec('optimism_reasoner', 'deepseek-reasoner'),
  createSpec('optimism_writer'),
  createSpec('optimism_builder', 'deepseek-reasoner'),
  createSpec('optimism_analyst', 'deepseek-reasoner'),
  createSpec('optimism_researcher', 'deepseek-reasoner'),
  createSpec('optimism_summarizer'),
  createSpec('optimism_translator'),
  createSpec('optimism_planner'),
  createSpec('optimism_brainstormer'),
  createSpec('optimism_supporter'),
  createSpec('optimism_strategy', 'deepseek-reasoner'),
  createSpec('optimism_quick'),
  createSpec('optimism_voice'),
];

function createRequest(overrides = {}) {
  const { body: bodyOverrides, ...rest } = overrides;
  return {
    body: {
      endpoint: 'Deepseek',
      endpointType: 'custom',
      conversationId: 'convo-1',
      text: 'Hello there',
      createdAt: baseDate,
      updatedAt: baseDate,
      ...bodyOverrides,
    },
    config: { modelSpecs: { list: specList } },
    user: { id: 'user-1' },
    baseUrl: '/api/agents/chat',
    ...rest,
  };
}

describe('applyAutoRouting', () => {
  beforeEach(() => {
    resetGauge();
    jest.clearAllMocks();
  });

  it('auto enables web search when explicit search intent is detected', () => {
    const req = createRequest({
      body: {
        text: 'Please search the web for the latest optimism news.',
        web_search: false,
      },
    });

    const result = applyAutoRouting(req);

    expect(result.candidate.autoWebSearch).toBe(true);
    expect(req.body.web_search).toBe(true);
    expect(req.body.spec).toBe('optimism_researcher');
    expect(result.candidate.reason).toEqual(
      expect.arrayContaining([expect.stringContaining('web_search')]),
    );
    expect(result.candidate.keywordHits).toEqual([]);
    expect(result.gauge.intent).toBe('research');
  });

  it('enables the ephemeral agent web search flag when auto toggled', () => {
    const req = createRequest({
      body: {
        text: 'Please search the web for the latest optimism news.',
        web_search: false,
        ephemeralAgent: null,
      },
    });

    applyAutoRouting(req);

    expect(req.body.web_search).toBe(true);
    expect(req.body.ephemeralAgent).toBeDefined();
    expect(req.body.ephemeralAgent.web_search).toBe(true);
  });

  it('auto enables web search when toggle strings disable it explicitly', () => {
    const req = createRequest({
      body: {
        text: 'Search the web for recent optimism research breakthroughs.',
        web_search: 'false',
      },
    });

    const result = applyAutoRouting(req);

    expect(result.candidate.autoWebSearch).toBe(true);
    expect(req.body.web_search).toBe(true);
    expect(req.body.spec).toBe('optimism_researcher');
    expect(result.candidate.reason).toEqual(
      expect.arrayContaining([expect.stringContaining('web_search')]),
    );
    expect(result.candidate.keywordHits).toEqual(
      expect.arrayContaining(['research']),
    );
    expect(result.gauge.intent).toBe('research');
  });

  it('routes writing intent to the writing preset', () => {
    const req = createRequest({
      body: {
        text: 'I need you to write a heartfelt blog post about resilience.',
      },
    });

    applyAutoRouting(req);
    expect(req.body.spec).toBe('optimism_writer');
    expect(req.body.model).toBe('deepseek-chat');
    expect(req.body.keywordHits).toBeUndefined();
  });

  it('honors the thinking toggle by escalating to the reasoning preset', () => {
    const req = createRequest({
      body: {
        text: 'Walk me through the reasoning behind this pricing structure.',
        thinking: true,
      },
    });

    applyAutoRouting(req);
    expect(req.body.spec).toBe('optimism_reasoner');
    expect(req.body.model).toBe('deepseek-reasoner');
  });

  it('routes web search requests to the research preset', () => {
    const req = createRequest({
      body: {
        text: 'Research the latest optimism studies and cite the sources.',
        web_search: true,
      },
    });

    applyAutoRouting(req);
    expect(req.body.spec).toBe('optimism_researcher');
    expect(req.body.model).toBe('deepseek-reasoner');
  });

  it('routes default agent endpoint requests using model specs', () => {
    const req = createRequest({
      body: {
        endpoint: 'agents',
        endpointType: 'agents',
        text: 'Find the latest research on optimism and provide sources.',
      },
    });

    applyAutoRouting(req);

    expect(req.body.endpoint).toBe('Deepseek');
    expect(req.body.endpointType).toBe('agents');
    expect(req.body.spec).toBe('optimism_researcher');
    expect(req.body.web_search).toBe(true);
  });

  it('uses code signals to route to the coding preset', () => {
    const req = createRequest({
      body: {
        text: 'Here is my failing snippet:```python\nprint(1/0)``` please debug it.',
        files: [
          {
            mimetype: 'text/x-python',
            filename: 'example.py',
          },
        ],
      },
    });

    const result = applyAutoRouting(req);

    expect(req.body.spec).toBe('optimism_builder');
    expect(result.candidate.keywordHits).toEqual(
      expect.arrayContaining([expect.stringContaining('codeblock')]),
    );
    expect(result.candidate.keywordHits).toEqual(
      expect.arrayContaining([expect.stringContaining('attachment:')]),
    );
  });

  it('detects multilingual requests and favors translation', () => {
    const req = createRequest({
      body: {
        text: 'Bonjour! ¿Puedes traducir esto al inglés y al español, por favor?',
      },
    });

    applyAutoRouting(req);

    expect(req.body.spec).toBe('optimism_translator');
  });

  it('skips auto routing when an agent id is provided', () => {
    const req = createRequest({
      body: {
        endpoint: 'agents',
        endpointType: 'agents',
        agent_id: 'agent-123',
        text: 'Write a plan for the week.',
      },
    });

    const result = applyAutoRouting(req);

    expect(result).toBeNull();
    expect(req.body.spec).toBeUndefined();
    expect(req.body.endpoint).toBe('agents');
  });

  describe('intent coverage', () => {
    const allIntentCases = [
      {
        name: 'defaults to companion preset when no strong signals are present',
        body: { text: 'Hello friend, how has your day been?' },
        expectedIntent: 'general_support',
        expectedSpec: 'optimism_companion',
        expectedReason: [],
        expectedKeywordHits: [],
      },
      {
        name: 'routes writing keywords to the writing preset',
        body: { text: 'Please write a heartfelt article celebrating resilience.' },
        expectedIntent: 'writing',
        expectedSpec: 'optimism_writer',
        reasonFragment: 'keywords:writing',
        keywordFragment: '\\bwrite\\b',
      },
      {
        name: 'routes coding terminology to the builder preset',
        body: { text: 'Fix the TypeScript function bug in the API controller.' },
        expectedIntent: 'coding',
        expectedSpec: 'optimism_builder',
        reasonFragment: 'keywords:coding',
        keywordFragment: '\\btypescript\\b',
      },
      {
        name: 'detects analytical language for the analyst preset',
        body: { text: 'Analyze the dataset metrics and deliver insights on the trend.' },
        expectedIntent: 'analysis',
        expectedSpec: 'optimism_analyst',
        reasonFragment: 'keywords:analysis',
        keywordFragment: 'trend',
      },
      {
        name: 'detects research phrasing for the researcher preset',
        body: { text: 'Research credible sources and cite the reference for optimism studies.' },
        expectedIntent: 'research',
        expectedSpec: 'optimism_researcher',
        reasonFragment: 'keywords:research',
        keywordFragment: 'research',
      },
      {
        name: 'detects summary requests for the summarizer preset',
        body: { text: 'Summarize the announcement and condense it into an overview.' },
        expectedIntent: 'summary',
        expectedSpec: 'optimism_summarizer',
        reasonFragment: 'keywords:summary',
        keywordFragment: 'summari',
      },
      {
        name: 'detects translation requests for the translator preset',
        body: { text: 'Translate this announcement into Spanish for our community.' },
        expectedIntent: 'translation',
        expectedSpec: 'optimism_translator',
        reasonFragment: 'keywords:translation',
        keywordFragment: 'translate',
      },
      {
        name: 'detects planning language for the planner preset',
        body: { text: 'Draft a rollout plan with a timeline and milestones.' },
        expectedIntent: 'planning',
        expectedSpec: 'optimism_planner',
        reasonFragment: 'keywords:planning',
        keywordFragment: 'plan',
      },
      {
        name: 'detects brainstorming signals for the brainstormer preset',
        body: { text: 'Brainstorm creative name ideas for the new campaign.' },
        expectedIntent: 'brainstorming',
        expectedSpec: 'optimism_brainstormer',
        reasonFragment: 'keywords:brainstorming',
        keywordFragment: 'brainstorm',
      },
      {
        name: 'supports emotional language with the supporter preset',
        body: { text: 'I feel overwhelmed and anxious about my workload lately.' },
        expectedIntent: 'support',
        expectedSpec: 'optimism_supporter',
        reasonFragment: 'keywords:support',
        keywordFragment: 'feel',
      },
      {
        name: 'detects strategic phrasing for the strategy preset',
        body: { text: 'Outline a strategy to prioritize growth initiatives this quarter.' },
        expectedIntent: 'strategy',
        expectedSpec: 'optimism_strategy',
        reasonFragment: 'keywords:strategy',
        keywordFragment: 'strategy',
      },
      {
        name: 'detects rapid-response cues for the quick preset',
        body: { text: 'Quick! Give me a concise answer.' , max_tokens: 900 },
        expectedIntent: 'quick',
        expectedSpec: 'optimism_quick',
        reasonFragment: 'signal:quick',
      },
    ];

    it.each(allIntentCases)(' %s', ({
      body,
      expectedIntent,
      expectedSpec,
      expectedReason,
      reasonFragment,
      extraReason,
      expectedKeywordHits,
      keywordFragment,
    }) => {
      const request = createRequest({ body });
      const result = applyAutoRouting(request);

      expect(result.intent).toBe(expectedIntent);
      expect(result.spec).toBe(expectedSpec);
      expect(result.gauge.intent).toBe(expectedIntent);

      if (expectedReason) {
        expect(result.candidate.reason).toEqual(expectedReason);
      }

      if (reasonFragment) {
        expect(result.candidate.reason).toContain(reasonFragment);
      }

      if (extraReason) {
        expect(result.candidate.reason).toContain(extraReason);
      }

      if (expectedKeywordHits) {
        expect(result.candidate.keywordHits).toEqual(expectedKeywordHits);
      }

      if (keywordFragment) {
        expect(result.candidate.keywordHits).toEqual(
          expect.arrayContaining([expect.stringContaining(keywordFragment)]),
        );
      } else {
        expect(result.candidate.keywordHits).toEqual([]);
      }
    });
  });

  it('escalates to deep reasoning based on depth cues without toggles', () => {
    const req = createRequest({
      body: {
        text: 'Deliver a comprehensive, in-depth breakdown with exhaustive reasoning.',
        max_tokens: 7000,
      },
    });

    const result = applyAutoRouting(req);

    expect(result.intent).toBe('deep_reasoning');
    expect(result.spec).toBe('optimism_reasoner');
    expect(result.candidate.reason).toContain('signal:depth');
    expect(result.candidate.keywordHits).toEqual([]);
    expect(result.gauge.intent).toBe('deep_reasoning');
    expect(result.gauge.intensity).toBeGreaterThan(0.7);
  });

  it('maintains prior coding intent when writing intensity is below switch margin', () => {
    const conversationId = 'convo-borderline';
    const codingReq = createRequest({
      body: {
        conversationId,
        text: 'Fix the TypeScript function bug in the API controller.',
      },
    });

    const firstResult = applyAutoRouting(codingReq);
    expect(firstResult.intent).toBe('coding');
    expect(firstResult.candidate.reason).toContain('keywords:coding');

    const writingReq = createRequest({
      body: {
        conversationId,
        text: 'Please draft and write a reflective paragraph about optimism.',
      },
    });

    const secondResult = applyAutoRouting(writingReq);

    const writingSignal = secondResult.candidate.keywordSignals.find(
      (signal) => signal.intent === 'writing',
    );
    expect(writingSignal).toBeDefined();
    expect(writingSignal.intensity).toBeGreaterThan(0.7);
    expect(writingSignal.hits).toEqual(
      expect.arrayContaining([expect.stringContaining('\\bwrite\\b')]),
    );
    expect(secondResult.gauge.intent).toBe('coding');
    expect(secondResult.gauge.intensity).toBeGreaterThanOrEqual(secondResult.candidate.intensity);
  });

  it('recovers by switching intents after cooldown and decay reduce prior intensity', () => {
    jest.useFakeTimers();
    try {
      const conversationId = 'convo-decay';
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

      const researchReq = createRequest({
        body: {
          conversationId,
          text: 'Research the latest optimism studies and cite the sources.',
          web_search: true,
        },
      });

      const firstResult = applyAutoRouting(researchReq);
      expect(firstResult.intent).toBe('research');
      expect(firstResult.gauge.intent).toBe('research');

      const writingSignal = {
        body: {
          conversationId,
          text: 'Please write an article explaining optimism for our blog audience.',
        },
      };

      const immediateResult = applyAutoRouting(createRequest(writingSignal));
      expect(immediateResult.candidate.intent).toBe('writing');
      expect(immediateResult.candidate.reason).toContain('keywords:writing');
      expect(immediateResult.gauge.intent).toBe('research');

      jest.advanceTimersByTime(120000);

      const recoveredResult = applyAutoRouting(createRequest(writingSignal));

      expect(recoveredResult.intent).toBe('writing');
      expect(recoveredResult.gauge.intent).toBe('writing');
      expect(recoveredResult.candidate.reason).toContain('keywords:writing');
      expect(recoveredResult.candidate.keywordHits).toEqual(
        expect.arrayContaining([expect.stringContaining('\\bwrite\\b')]),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('resists near-miss keywords that should not trigger coding intent', () => {
    const req = createRequest({
      body: {
        text: 'The audio is encoded through a complex codec; please decode the message.',
      },
    });

    const result = applyAutoRouting(req);

    expect(result.intent).toBe('general_support');
    expect(result.spec).toBe('optimism_companion');
    expect(result.candidate.keywordHits).toEqual([]);
    expect(result.candidate.reason).toEqual([]);
    expect(result.gauge.intent).toBe('general_support');
    // Known blind spot: words ending with "script" (e.g., "transcript") still trigger coding intent via /script\b/.
  });

  it('prefers the quick preset for concise requests with a small token budget', () => {
    const req = createRequest({
      body: {
        text: 'Quick question: give me a brief, bullet-point reminder of our goals.',
        max_tokens: 512,
      },
    });

    applyAutoRouting(req);
    expect(req.body.spec).toBe('optimism_quick');
  });

  it('skips auto routing when opted out with an explicit spec', () => {
    const req = createRequest({
      body: {
        text: 'Quickly outline a go-to-market strategy.',
        max_tokens: 256,
        spec: 'optimism_strategy',
        model: 'deepseek-reasoner',
        auto_router_opt_out: true,
      },
    });

    const result = applyAutoRouting(req);

    expect(result).toBeNull();
    expect(req.body.spec).toBe('optimism_strategy');
    expect(req.body.model).toBe('deepseek-reasoner');
    expect(req.autoRoutedConversation).toEqual(expect.objectContaining({ spec: 'optimism_strategy' }));
  });

  it('continues auto routing when the default spec is provided without opt-out', () => {
    const req = createRequest({
      body: {
        text: 'Please draft a heartfelt blog post announcing our latest optimism milestone.',
        spec: 'optimism_companion',
        model: 'deepseek-chat',
      },
    });

    const result = applyAutoRouting(req);

    expect(result).toBeTruthy();
    expect(result.intent).toBe('writing');
    expect(result.spec).toBe('optimism_writer');
    expect(req.body.spec).toBe('optimism_writer');
    expect(req.autoRoutedConversation).toEqual(
      expect.objectContaining({
        spec: 'optimism_writer',
        model: 'deepseek-chat',
      }),
    );
  });

  it('logs the routed spec and model in the info message', () => {
    const req = createRequest({
      body: {
        text: 'I need you to write a heartfelt blog post about resilience.',
      },
    });

    applyAutoRouting(req);

    expect(logger.info).toHaveBeenCalledWith(
      '[AutoRouter] Routed to optimism_writer (deepseek-chat)',
      expect.objectContaining({
        spec: 'optimism_writer',
        model: 'deepseek-chat',
      }),
    );
  });
});
