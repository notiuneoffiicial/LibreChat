import React, { useMemo } from 'react';
import { LocalStorageKeys } from 'librechat-data-provider';
import { Button } from '@librechat/client';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { RESTART_GUIDED_TOUR_EVENT } from '~/common/events';

const ensureUrl = (value?: string) => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).href;
  } catch {
    const sanitized = value.replace(/^[a-zA-Z]+:\/\//, '');
    try {
      return new URL(`https://${sanitized}`).href;
    } catch {
      return null;
    }
  }
};

function Support() {
  const localize = useLocalize();
  const { data: startupConfig } = useGetStartupConfig();

  const docsHref = useMemo(
    () => ensureUrl(startupConfig?.helpAndFaqURL) ?? 'https://librechat.ai',
    [startupConfig?.helpAndFaqURL],
  );

  const contactHref = useMemo(() => {
    if (!startupConfig?.helpAndFaqURL) {
      return 'https://librechat.ai/contact';
    }

    const resolved = ensureUrl(startupConfig.helpAndFaqURL);
    if (!resolved) {
      return 'https://librechat.ai/contact';
    }

    return resolved;
  }, [startupConfig?.helpAndFaqURL]);

  const handleReplayTour = () => {
    localStorage.removeItem(LocalStorageKeys.ONBOARDING_COMPLETED);
    window.dispatchEvent(new Event(RESTART_GUIDED_TOUR_EVENT));
  };

  const handleOpenDocs = () => {
    window.open(docsHref, '_blank', 'noopener,noreferrer');
  };

  const handleContact = () => {
    window.open(contactHref, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col gap-6 p-1 text-sm text-text-primary">
      <section className="space-y-2">
        <h3 className="text-base font-medium text-text-primary">
          {localize('com_nav_support_get_started')}
        </h3>
        <p className="text-sm text-text-secondary">
          {localize('com_nav_support_get_started_desc')}
        </p>
        <Button
          variant="secondary"
          className="w-fit"
          onClick={handleReplayTour}
          data-testid="support-restart-tour"
        >
          {localize('com_nav_support_restart_tour')}
        </Button>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-medium text-text-primary">
          {localize('com_nav_support_learn_more')}
        </h3>
        <p className="text-sm text-text-secondary">
          {localize('com_nav_support_learn_more_desc')}
        </p>
        <Button className="w-fit" onClick={handleOpenDocs} data-testid="support-open-docs">
          {localize('com_nav_support_open_docs')}
        </Button>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-medium text-text-primary">
          {localize('com_nav_support_contact')}
        </h3>
        <p className="text-sm text-text-secondary">
          {localize('com_nav_support_contact_desc')}
        </p>
        <Button variant="outline" className="w-fit" onClick={handleContact} data-testid="support-contact">
          {localize('com_nav_support_contact_button')}
        </Button>
      </section>
    </div>
  );
}

export default React.memo(Support);

