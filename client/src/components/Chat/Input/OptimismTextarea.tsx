import React, { forwardRef } from 'react';
import RTA from 'react-textarea-autosize';
import { TextareaAutosize as BaseTA } from '@librechat/client';

type Props = React.ComponentProps<typeof RTA>;

const OptimismTextarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ placeholder: _ignored, ...rest }, ref) => (
    <BaseTa
    <RTA
      ref={ref}
      {...rest}
      placeholder="Ask OptimismAI"
      aria-label="Ask OptimismAI"
    />
    />
  ),
);

OptimismTextarea.displayName = 'OptimismTextarea';
export default OptimismTextarea;
