import { memo, useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { useForm } from 'react-hook-form';
import { Spinner } from '@librechat/client';
import { useParams } from 'react-router-dom';
import { Constants, buildTree } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import type { ChatFormValues } from '~/common';
import { ChatContext, AddedChatContext, useFileMapContext, ChatFormProvider } from '~/Providers';
import { useChatHelpers, useAddedResponse, useSSE } from '~/hooks';
import ConversationStarters from './Input/ConversationStarters';
import { useGetMessagesByConvoId } from '~/data-provider';
import MessagesView from './Messages/MessagesView';
import Presentation from './Presentation';
import ChatForm from './Input/ChatForm';
import Landing from './Landing';
import Header from './Header';
import Footer from './Footer';
import { cn } from '~/utils';
import store from '~/store';
import VoiceModeOverlay from './VoiceMode/VoiceModeOverlay';
import GuidedTour from '../Onboarding/GuidedTour';
import NewsGrid from '../News/NewsGrid';
import useNewsFeed from '../News/useNewsFeed';

function LoadingSpinner() {
  return (
    <div className="relative flex-1 overflow-hidden overflow-y-auto">
      <div className="relative flex h-full items-center justify-center">
        <Spinner className="text-text-primary" />
      </div>
    </div>
  );
}

function ChatView({ index = 0 }: { index?: number }) {
  const { conversationId } = useParams();
  const rootSubmission = useRecoilValue(store.submissionByIndex(index));
  const addedSubmission = useRecoilValue(store.submissionByIndex(index + 1));
  const centerFormOnLanding = useRecoilValue(store.centerFormOnLanding);

  const fileMap = useFileMapContext();
  const [activeView, setActiveView] = useState<'chat' | 'news'>('chat');
  const isChatView = activeView === 'chat';

  const { data: messagesTree = null, isLoading } = useGetMessagesByConvoId(conversationId ?? '', {
    select: useCallback(
      (data: TMessage[]) => {
        const dataTree = buildTree({ messages: data, fileMap });
        return dataTree?.length === 0 ? null : (dataTree ?? null);
      },
      [fileMap],
    ),
    enabled: !!fileMap,
  });

  const chatHelpers = useChatHelpers(index, conversationId);
  const addedChatHelpers = useAddedResponse({ rootIndex: index });

  const { articles: newsArticles, isLoading: isNewsLoading, isError: isNewsError } = useNewsFeed();

  useSSE(rootSubmission, chatHelpers, false);
  useSSE(addedSubmission, addedChatHelpers, true);

  const methods = useForm<ChatFormValues>({
    defaultValues: { text: '' },
  });

  let content: JSX.Element | null | undefined;
  const isLandingPage =
    (!messagesTree || messagesTree.length === 0) &&
    (conversationId === Constants.NEW_CONVO || !conversationId);
  const isNavigating = (!messagesTree || messagesTree.length === 0) && conversationId != null;

  if (isChatView) {
    if (isLoading && conversationId !== Constants.NEW_CONVO) {
      content = <LoadingSpinner />;
    } else if ((isLoading || isNavigating) && !isLandingPage) {
      content = <LoadingSpinner />;
    } else if (!isLandingPage) {
      content = <MessagesView messagesTree={messagesTree} />;
    } else {
      content = <Landing centerFormOnLanding={centerFormOnLanding} />;
    }
  }

  const handleToggle = (view: 'chat' | 'news') => {
    setActiveView(view);
  };

  const toggleButtonClasses = (isActive: boolean) =>
    cn(
      'rounded-full border px-4 py-1 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring focus-visible:ring-accent-primary/40',
      isActive
        ? 'border-accent-primary bg-accent-primary/10 text-text-primary shadow-sm hover:bg-accent-primary/15 active:bg-accent-primary/20'
        : 'border-transparent text-text-secondary hover:border-border-medium hover:bg-surface-tertiary hover:text-text-primary active:bg-surface-hover',
    );

  return (
    <ChatFormProvider {...methods}>
      <ChatContext.Provider value={chatHelpers}>
        <AddedChatContext.Provider value={addedChatHelpers}>
          <Presentation>
            <div className="flex h-full w-full flex-col">
              {!isLoading && <Header />}
              <div className="flex w-full justify-center px-4 pb-3 pt-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-border-light bg-surface-primary p-1 shadow-sm">
                  <button
                    type="button"
                    className={toggleButtonClasses(isChatView)}
                    aria-pressed={isChatView}
                    onClick={() => handleToggle('chat')}
                  >
                    Chat
                  </button>
                  <button
                    type="button"
                    className={toggleButtonClasses(!isChatView)}
                    aria-pressed={!isChatView}
                    onClick={() => handleToggle('news')}
                  >
                    News
                  </button>
                </div>
              </div>
              {isChatView ? (
                <>
                  <div
                    data-tour="chat-messages"
                    className={cn(
                      'flex flex-col',
                      isLandingPage
                        ? 'flex-1 items-center justify-end sm:justify-center'
                        : 'h-full overflow-y-auto',
                    )}
                  >
                    {content}
                    <div
                      className={cn(
                        'w-full',
                        isLandingPage && 'max-w-3xl transition-all duration-200 xl:max-w-4xl',
                      )}
                    >
                      <ChatForm index={index} />
                      {isLandingPage ? <ConversationStarters /> : <Footer />}
                    </div>
                  </div>
                  {isLandingPage && <Footer />}
                </>
              ) : (
                <div className="h-full overflow-y-auto px-4 pb-6">
                  {isNewsLoading ? (
                    <LoadingSpinner />
                  ) : isNewsError ? (
                    <div className="flex h-full items-center justify-center text-sm text-text-secondary">
                      Unable to load positive news right now. Please try again later.
                    </div>
                  ) : newsArticles.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-text-secondary">
                      No uplifting stories are available yet.
                    </div>
                  ) : (
                    <NewsGrid articles={newsArticles} />
                  )}
                </div>
              )}
            </div>
            <VoiceModeOverlay index={index} />
            <GuidedTour />
          </Presentation>
        </AddedChatContext.Provider>
      </ChatContext.Provider>
    </ChatFormProvider>
  );
}

export default memo(ChatView);
