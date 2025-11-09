import React, { memo } from 'react';
import { Globe } from 'lucide-react';
import { CheckboxButton } from '@librechat/client';
import { Permissions, PermissionTypes } from 'librechat-data-provider';
import { useLocalize, useHasAccess } from '~/hooks';
import { useBadgeRowContext } from '~/Providers';

function WebSearch() {
  const localize = useLocalize();
  const { webSearch: webSearchData, searchApiKeyForm } = useBadgeRowContext();
  const { toggleState: webSearch, debouncedChange, isPinned } = webSearchData;
  const { badgeTriggerRef } = searchApiKeyForm;
  const isWebSearchActive = Boolean(webSearch);

  const canUseWebSearch = useHasAccess({
    permissionType: PermissionTypes.WEB_SEARCH,
    permission: Permissions.USE,
  });

  if (!canUseWebSearch) {
    return null;
  }

  if (!isWebSearchActive && !isPinned) {
    return null;
  }

  return (
    <div data-tour="web-search-toggle" className="flex">
      <CheckboxButton
        ref={badgeTriggerRef}
        className="max-w-fit"
        checked={isWebSearchActive}
        setValue={debouncedChange}
        label={localize('com_ui_search')}
        isCheckedClassName="border-blue-600/40 bg-blue-500/10 hover:bg-blue-700/10"
        icon={<Globe className="icon-md" />}
      />
    </div>
  );
}

export default memo(WebSearch);
