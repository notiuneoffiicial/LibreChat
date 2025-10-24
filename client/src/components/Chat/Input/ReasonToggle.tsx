import { memo } from 'react';
import { Brain } from 'lucide-react';
import { CheckboxButton } from '@librechat/client';
import { useBadgeRowContext } from '~/Providers';

function ReasonToggle() {
  const { reason } = useBadgeRowContext();
  const { toggleState: isReasoning, debouncedChange, isPinned, isAvailable } = reason;

  if (!isAvailable) {
    return null;
  }

  if (!isReasoning && !isPinned) {
    return null;
  }

  return (
    <CheckboxButton
      className="max-w-fit"
      checked={isReasoning}
      setValue={debouncedChange}
      label="Reason"
      isCheckedClassName="border-purple-500/40 bg-purple-500/10 hover:bg-purple-600/10"
      icon={<Brain className="icon-md" />}
    />
  );
}

export default memo(ReasonToggle);
