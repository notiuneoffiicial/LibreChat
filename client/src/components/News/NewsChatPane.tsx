
import React from 'react';
import ChatForm from '../Chat/Input/ChatForm';
import MessagesView from '../Chat/Messages/MessagesView';
import type { TMessage } from 'librechat-data-provider';

type NewsChatPaneProps = {
    messagesTree?: TMessage[] | null;
    index?: number;
};

const NewsChatPane = ({ messagesTree, index = 1 }: NewsChatPaneProps) => {
    return (
        <div className="flex flex-col h-full w-full bg-surface-primary border-l border-border-light">
            <div className="flex-1 overflow-hidden">
                <MessagesView messagesTree={messagesTree} />
            </div>
            <div className="p-4 border-t border-border-light">
                <ChatForm index={index} headerPlaceholder="Chat about this article" />
            </div>
        </div>
    );
};

export default NewsChatPane;
