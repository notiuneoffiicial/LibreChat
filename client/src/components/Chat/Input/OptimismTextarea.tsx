import React from 'react';
import { TextareaAutosize as BaseTA } from '@librechat/client';

// Force OUR placeholder/aria-label no matter what upstream tries
export default function OptimismTextarea(
  props: React.ComponentProps<typeof BaseTA>
) {
  const { placeholder: _ignored, ...rest } = props; // ignore any upstream placeholder
  return (
    <BaseTA
      {...rest}
      placeholder="Ask OptimismAI"
      aria-label="Ask OptimismAI"
    />
  );
}
