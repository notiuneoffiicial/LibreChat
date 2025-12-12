
import React from 'react';
import { useRecoilValue } from 'recoil';
import store from '~/store';
import { useLocalize } from '~/hooks';

const NewsHistory = () => {
    const localize = useLocalize();
    // Placeholder for real history logic. 
    // In a real app, we would query conversations with a specific tag or metadata "isNews: true"

    return (
        <div className="flex flex-col gap-2 p-2 text-sm text-text-primary">
            <div className="px-2 font-semibold text-text-secondary uppercase text-xs tracking-wide">
                News Chats
            </div>
            <div className="p-4 text-center text-text-secondary italic">
                No news chats yet. Click on an article to start discussing!
            </div>
        </div>
    );
};

export default NewsHistory;
