
import React from 'react';
import { useLocalize } from '~/hooks';

const NewsHistory = () => {
    const localize = useLocalize();

    return (
        <div className="flex flex-col h-full">
            <div className="mt-2 pl-2 pt-1 text-text-secondary" style={{ fontSize: '0.7rem' }}>
                NEWS CHATS
            </div>
            <div className="flex-1 flex items-center justify-center p-4 text-center text-text-secondary text-sm italic">
                Select a news article to start a discussion.
            </div>
        </div>
    );
};

export default NewsHistory;
