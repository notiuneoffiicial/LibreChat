// client/src/components/Chat/Input/OptimismTextarea.tsx
import React, { forwardRef } from 'react';
import { TextareaAutosize as BaseTA } from '@librechat/client';

type Props = React.ComponentProps<typeof BaseTA>;

const OptimismTextarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ placeholder: _ignored, ...rest }, ref) => (
    <BaseTA
      ref={ref}                    // ✅ critical: used to clear/focus after send
      {...rest}                    // ✅ keep all handlers/props intact
      placeholder="Ask OptimismAI" // your brand copy
      aria-label="Ask OptimismAI"
    />
  ),
);

OptimismTextarea.displayName = 'OptimismTextarea';
export default OptimismTextarea;
