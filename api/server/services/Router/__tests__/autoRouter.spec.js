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
