
import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';
import { useForm } from 'react-hook-form';
import { Spinner } from '@librechat/client';
import { ChatContext, AddedChatContext, ChatFormProvider } from '~/Providers';
import { useChatHelpers, useAddedResponse, useSSE } from '~/hooks';
import ChatForm from '../Chat/Input/ChatForm';
import store from '~/store';
import { buildTree } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import type { ChatFormValues } from '~/common';
import type { NewsArticle } from './newsData';
import NewsChatPane from './NewsChatPane';
import { useGetMessagesByConvoId } from '~/data-provider';
import DOMPurify from 'dompurify';
import { X } from 'lucide-react';

type NewsReaderProps = {
    article: NewsArticle & { content?: string; pubDate?: string };
    onClose: () => void;
};

const LoadingSpinner = () => (
    <div className="flex h-full items-center justify-center">
        <Spinner className="text-text-primary" />
    </div>
);

const NewsReader = ({ article, onClose }: NewsReaderProps) => {
    const index = 1; // Separate index for news chat
    const [conversationId, setConversationId] = useState('new');
    const [isChatOpen, setIsChatOpen] = useState(false);

    // Initialize Chat Helpers
    const chatHelpers = useChatHelpers(index, conversationId);
    const addedChatHelpers = useAddedResponse({ rootIndex: index });

    const rootSubmission = useRecoilState(store.submissionByIndex(index))[0];
    const addedSubmission = useRecoilState(store.submissionByIndex(index + 1))[0];

    // SSE Hooks
    useSSE(rootSubmission, chatHelpers, false, index);
    useSSE(addedSubmission, addedChatHelpers, true, index + 1);

    // Form Methods
    const methods = useForm<ChatFormValues>({
        defaultValues: { text: '' },
    });

    const originalAsk = chatHelpers.ask;
    const wrappedAsk = useCallback<typeof originalAsk>(
        (message, options) => {
            setIsChatOpen(true);
            originalAsk(message, { ...options, shouldNavigate: false });
        },
        [originalAsk]
    );

    const modifiedChatHelpers = useMemo(() => ({
        ...chatHelpers,
        ask: wrappedAsk,
    }), [chatHelpers, wrappedAsk]);

    // Messages
    const fileMap = chatHelpers.files;
    const { data: messagesTree = null } = useGetMessagesByConvoId(conversationId, {
        enabled: true,
        select: (data: TMessage[]) => buildTree({ messages: data, fileMap }),
    });

    // Clean Content
    const cleanContent = (html: string) => {
        return DOMPurify.sanitize(html, { FORBID_TAGS: ['img'] });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-200">
            {/* Modal Card - Relative for Absolute positioning of Composer */}
            <div className="relative flex h-full w-full max-w-6xl flex-col bg-surface-primary shadow-2xl md:rounded-t-2xl overflow-hidden">
                <ChatFormProvider {...methods}>
                    <ChatContext.Provider value={modifiedChatHelpers}>
                        <AddedChatContext.Provider value={addedChatHelpers}>

                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-border-light px-6 py-4 shrink-0 bg-surface-primary z-20">
                                <div className="flex flex-col overflow-hidden">
                                    <h2 className="text-xl font-bold text-text-primary line-clamp-1" title={article.title}>
                                        {article.title}
                                    </h2>
                                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                                        <span className="font-medium text-accent-primary">{article.source}</span>
                                        <span>•</span>
                                        <span>{article.pubDate ? new Date(article.pubDate).toLocaleDateString() : ''}</span>
                                    </div>
                                </div>
                                <button onClick={onClose} className="rounded-full p-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors shrink-0 ml-4">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            {/* Content Area - Sibling to Composer */}
                            <div className="flex-1 flex overflow-hidden relative">
                                <div className={`flex-1 overflow-y-auto p-6 md:p-10 pb-48 transition-all duration-300 ${isChatOpen ? 'w-2/3' : 'w-full'}`}>
                                    <div className="mx-auto max-w-3xl flex flex-col items-center">
                                        {article.image && (
                                            <img
                                                src={article.image}
                                                alt={article.title}
                                                className="mb-8 h-64 w-full rounded-xl object-cover shadow-sm md:h-96"
                                            />
                                        )}
                                        <div
                                            className="prose prose-lg dark:prose-invert max-w-none text-text-primary text-center"
                                            dangerouslySetInnerHTML={{ __html: cleanContent(article.content || article.summary || '') }}
                                        />
                                        <div className="mt-10 flex justify-center border-t border-border-light pt-8 mb-20">
                                            <a href={article.link} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline font-semibold">
                                                Read full article on original site
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {isChatOpen && (
                                    <div className="w-1/3 min-w-[320px] transition-all duration-300 border-l border-border-light">
                                        <NewsChatPane messagesTree={messagesTree} index={index} />
                                    </div>
                                )}
                            </div>

                            {/* Composer - Sibling to Content, Absolute Bottom */}
                            {!isChatOpen && (
                                <div className="absolute bottom-0 w-full bg-gradient-to-t from-surface-primary via-surface-primary to-transparent pt-10 px-4 pb-8 z-30">
                                    <div className="mx-auto max-w-3xl">
                                        <ChatForm index={index} headerPlaceholder="Chat about this article" />
                                    </div>
                                </div>
                            )}

                        </AddedChatContext.Provider>
                    </ChatContext.Provider>
                </ChatFormProvider>
            </div>
        </div>
    );
};

export default NewsReader;
