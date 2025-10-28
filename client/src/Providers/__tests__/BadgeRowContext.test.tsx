import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { LocalStorageKeys } from 'librechat-data-provider';
import BadgeRowProvider, { useBadgeRowContext } from '../BadgeRowContext';
import { ChatContext } from '../ChatContext';

jest.mock('~/utils/timestamps', () => ({
  getTimestampedValue: jest.fn(() => null),
  setTimestamp: jest.fn(),
}));

jest.mock('~/hooks/Input/useReasonToggle', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    toggleState: false,
    handleChange: jest.fn(),
    debouncedChange: jest.fn(),
    isPinned: true,
    setIsPinned: jest.fn(),
    isAvailable: true,
  })),
}));

jest.mock('~/hooks', () => {
  const { useRecoilState } = require('recoil');
  const { Constants } = require('librechat-data-provider');
  const { ephemeralAgentByConvoId } = require('~/store');

  return {
    useMCPServerManager: jest.fn(() => ({})),
    useSearchApiKeyForm: jest.fn(() => ({
      setIsDialogOpen: jest.fn(),
      badgeTriggerRef: { current: null },
    })),
    useGetAgentsConfig: jest.fn(() => ({ agentsConfig: null })),
    useCodeApiKeyForm: jest.fn(() => ({ setIsDialogOpen: jest.fn() })),
    useToolToggle: jest.fn(({ conversationId, toolKey }) => {
      const key = conversationId ?? Constants.NEW_CONVO;
      const [ephemeralAgent, setEphemeralAgent] = useRecoilState(ephemeralAgentByConvoId(key));
      const currentValue = ephemeralAgent?.[toolKey] ?? false;

      const updateValue = (input: any) => {
        const value = typeof input === 'object' && input !== null && 'value' in input ? input.value : input;
        setEphemeralAgent((prev: Record<string, any> | null) => ({
          ...(prev || {}),
          [toolKey]: value,
        }));
      };

      return {
        toggleState: currentValue,
        handleChange: (args: any) => updateValue(args),
        isToolEnabled: Boolean(currentValue),
        toolValue: currentValue,
        setToggleState: (value: any) => updateValue(value),
        ephemeralAgent,
        debouncedChange: (args: any) => updateValue(args),
        setEphemeralAgent,
        authData: undefined,
        isPinned: true,
        setIsPinned: jest.fn(),
      };
    }),
  };
});

describe('BadgeRowProvider', () => {
  const { getTimestampedValue } = require('~/utils/timestamps');

  const conversation = {
    conversationId: 'test-convo-id',
    web_search: true,
  } as any;

  const chatContextValue = {
    conversation,
    setConversation: jest.fn(),
    newConversation: jest.fn(),
    isSubmitting: false,
    setIsSubmitting: jest.fn(),
    getMessages: jest.fn(),
    setMessages: jest.fn(),
    setSiblingIdx: jest.fn(),
    latestMessage: null,
    setLatestMessage: jest.fn(),
    resetLatestMessage: jest.fn(),
    ask: jest.fn(),
    index: 0,
    regenerate: jest.fn(),
    stopGenerating: jest.fn(),
    handleStopGenerating: jest.fn(),
    handleRegenerate: jest.fn(),
    handleContinue: jest.fn(),
    showPopover: false,
    setShowPopover: jest.fn(),
    abortScroll: false,
    setAbortScroll: jest.fn(),
    preset: null,
    setPreset: jest.fn(),
    optionSettings: {},
    setOptionSettings: jest.fn(),
    showAgentSettings: false,
    setShowAgentSettings: jest.fn(),
    files: [],
    setFiles: jest.fn(),
    filesLoading: false,
    setFilesLoading: jest.fn(),
  } as any;

  const TestConsumer = () => {
    const { webSearch } = useBadgeRowContext();
    return <div data-testid="web-search-toggle">{String(Boolean(webSearch.toggleState))}</div>;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (getTimestampedValue as jest.Mock).mockImplementation((key: string) => {
      if (key.startsWith(`${LocalStorageKeys.LAST_WEB_SEARCH_TOGGLE_}${conversation.conversationId}`)) {
        return 'false';
      }
      return null;
    });
  });

  it('syncs the web search toggle from the active conversation', async () => {
    render(
      <RecoilRoot>
        <ChatContext.Provider value={chatContextValue}>
          <BadgeRowProvider conversationId={conversation.conversationId}>
            <TestConsumer />
          </BadgeRowProvider>
        </ChatContext.Provider>
      </RecoilRoot>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('web-search-toggle').textContent).toBe('true');
    });

  });
});
