const TEXT_KEY_PATTERN = /(?:text|transcript|content|value|word|caption|utterance|delta|string|display|normalized)/i;

function longestCommonPrefixLength(a, b) {
  const max = Math.min(a.length, b.length);
  let index = 0;

  while (index < max && a[index] === b[index]) {
    index += 1;
  }

  return index;
}

function longestCommonSuffixLength(a, b) {
  const max = Math.min(a.length, b.length);
  let index = 0;

  while (index < max && a[a.length - 1 - index] === b[b.length - 1 - index]) {
    index += 1;
  }

  return index;
}

function shouldRewriteTranscript(previous, incoming) {
  const prior = typeof previous === 'string' ? previous.trim() : '';
  const next = typeof incoming === 'string' ? incoming.trim() : '';

  if (!prior || !next || prior === next) {
    return false;
  }

  const lowerPrior = prior.toLowerCase();
  const lowerNext = next.toLowerCase();

  if (lowerNext.includes(lowerPrior) && !lowerNext.startsWith(lowerPrior)) {
    return true;
  }

  if (lowerPrior.includes(lowerNext)) {
    return true;
  }

  const prefixLength = longestCommonPrefixLength(lowerPrior, lowerNext);
  if (prefixLength > 0 && prefixLength < lowerPrior.length) {
    return true;
  }

  const suffixLength = longestCommonSuffixLength(lowerPrior, lowerNext);
  if (suffixLength > 0 && suffixLength < lowerPrior.length) {
    return true;
  }

  return false;
}

function appendTranscriptSegment(previous, incoming, options = {}) {
  const { allowRewrite = false } = options;
  const prior = typeof previous === 'string' ? previous : '';
  const next = typeof incoming === 'string' ? incoming : '';

  if (!next) {
    return { next: prior, delta: '', rewrite: false };
  }

  if (!prior) {
    return { next, delta: next, rewrite: false };
  }

  if (next === prior) {
    return { next: prior, delta: '', rewrite: false };
  }

  if (next.startsWith(prior)) {
    return { next, delta: next.slice(prior.length), rewrite: false };
  }

  if (prior.endsWith(next) || prior.includes(next)) {
    return { next: prior, delta: '', rewrite: false };
  }

  if (allowRewrite && shouldRewriteTranscript(prior, next)) {
    return { next, delta: '', rewrite: true };
  }

  const maxOverlap = Math.min(prior.length, next.length);
  for (let i = maxOverlap; i > 0; i -= 1) {
    if (next.startsWith(prior.slice(-i))) {
      const delta = next.slice(i);
      return { next: prior + delta, delta, rewrite: false };
    }
  }

  const joiner = prior.endsWith(' ') || next.startsWith(' ') ? '' : ' ';
  const delta = joiner ? `${joiner}${next}` : next;
  return { next: `${prior}${delta}`, delta, rewrite: false };
}

function collectTextFromStructure(value, visited = new Set(), context = false) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return context && trimmed ? value : '';
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => collectTextFromStructure(item, visited, context))
      .filter(Boolean);

    if (parts.length === 0) {
      return '';
    }

    return context ? parts.join('') : parts.join(' ');
  }

  if (typeof value !== 'object') {
    return '';
  }

  if (visited.has(value)) {
    return '';
  }

  visited.add(value);

  const parts = Object.entries(value)
    .map(([key, item]) => {
      if (item == null) {
        return '';
      }

      const lowerKey = key.toLowerCase();
      const nextContext = context || TEXT_KEY_PATTERN.test(lowerKey);
      return collectTextFromStructure(item, visited, nextContext);
    })
    .filter(Boolean);

  visited.delete(value);

  if (parts.length === 0) {
    return '';
  }

  const joined = parts.join(' ');
  return context ? joined : joined.trim();
}

function extractTextFromTranscript(transcript) {
  if (!transcript) {
    return '';
  }

  if (typeof transcript === 'string') {
    return transcript;
  }

  if (Array.isArray(transcript)) {
    const combined = transcript
      .map((item) => extractTextFromTranscript(item))
      .filter(Boolean)
      .join(' ');

    const trimmed = combined.trim();
    return trimmed ? combined : '';
  }

  if (typeof transcript !== 'object') {
    return '';
  }

  if (typeof transcript.text === 'string' && transcript.text.trim()) {
    return transcript.text;
  }

  if (Array.isArray(transcript.text)) {
    const combined = transcript.text
      .map((item) => (typeof item === 'string' ? item : extractTextFromTranscript(item)))
      .filter(Boolean)
      .join('');

    if (combined.trim()) {
      return combined;
    }
  }

  if (Array.isArray(transcript.items)) {
    const combined = transcript.items
      .map((item) => {
        if (!item) {
          return '';
        }

        if (typeof item === 'string') {
          return item;
        }

        if (typeof item.text === 'string' && item.text.trim()) {
          return item.text;
        }

        if (Array.isArray(item.text)) {
          return item.text
            .map((entry) => (typeof entry === 'string' ? entry : extractTextFromTranscript(entry)))
            .filter(Boolean)
            .join('');
        }

        if (typeof item.content === 'string' && item.content.trim()) {
          return item.content;
        }

        if (Array.isArray(item.content)) {
          return item.content
            .map((entry) => (typeof entry === 'string' ? entry : extractTextFromTranscript(entry)))
            .filter(Boolean)
            .join('');
        }

        if (Array.isArray(item.alternatives)) {
          for (const alt of item.alternatives) {
            if (!alt) {
              continue;
            }

            if (typeof alt === 'string' && alt.trim()) {
              return alt;
            }

            if (typeof alt.text === 'string' && alt.text.trim()) {
              return alt.text;
            }
          }
        }

        if (typeof item.value === 'string' && item.value.trim()) {
          return item.value;
        }

        if (Array.isArray(item.value)) {
          return item.value
            .map((entry) => (typeof entry === 'string' ? entry : extractTextFromTranscript(entry)))
            .filter(Boolean)
            .join('');
        }

        return extractTextFromTranscript(item);
      })
      .filter(Boolean)
      .join(' ');

    if (combined.trim()) {
      return combined;
    }
  }

  if (transcript.transcript) {
    const text = extractTextFromTranscript(transcript.transcript);
    if (text) {
      return text;
    }
  }

  if (transcript.delta) {
    const text = extractTextFromDelta(transcript.delta);
    if (text) {
      return text;
    }
  }

  const fallback = collectTextFromStructure(transcript, new Set(), true);
  return fallback.trim() ? fallback : '';
}

function extractTextFromContent(content) {
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((item) => {
      if (!item) {
        return '';
      }

      if (typeof item === 'string') {
        return item;
      }

      if (typeof item.text === 'string') {
        return item.text;
      }

      return '';
    })
    .join('');
}

function extractTextFromResponse(response) {
  if (!response || typeof response !== 'object') {
    return '';
  }

  if (Array.isArray(response.output_text) && response.output_text.length > 0) {
    const text = response.output_text.filter((part) => typeof part === 'string').join('');
    if (text.trim()) {
      return text;
    }
  }

  if (Array.isArray(response.output)) {
    const text = response.output
      .map((item) => extractTextFromContent(item?.content))
      .filter(Boolean)
      .join('');

    if (text.trim()) {
      return text;
    }
  }

  if (Array.isArray(response.content)) {
    const text = extractTextFromContent(response.content);
    if (text.trim()) {
      return text;
    }
  }

  return '';
}

function extractTextFromDelta(delta) {
  if (!delta) {
    return '';
  }

  if (typeof delta === 'string') {
    return delta;
  }

  if (Array.isArray(delta)) {
    return delta
      .map((item) => extractTextFromDelta(item))
      .filter(Boolean)
      .join('');
  }

  if (typeof delta !== 'object') {
    return '';
  }

  if (typeof delta.text === 'string' && delta.text.trim()) {
    return delta.text;
  }

  if (Array.isArray(delta.text) && delta.text.length > 0) {
    const text = delta.text
      .map((item) => (typeof item === 'string' ? item : extractTextFromDelta(item)))
      .filter(Boolean)
      .join('');

    if (text.trim()) {
      return text;
    }
  }

  if (typeof delta.output_text === 'string' && delta.output_text.trim()) {
    return delta.output_text;
  }

  if (Array.isArray(delta.output_text) && delta.output_text.length > 0) {
    const text = delta.output_text
      .map((item) => (typeof item === 'string' ? item : extractTextFromDelta(item)))
      .filter(Boolean)
      .join('');

    if (text.trim()) {
      return text;
    }
  }

  if (delta.transcript) {
    const text = extractTextFromTranscript(delta.transcript);
    if (text) {
      return text;
    }
  }

  if (Array.isArray(delta.transcripts) && delta.transcripts.length > 0) {
    const text = delta.transcripts
      .map((entry) => extractTextFromTranscript(entry))
      .filter(Boolean)
      .join(' ')
      .trim();

    if (text) {
      return text;
    }
  }

  if (Array.isArray(delta.items) && delta.items.length > 0) {
    const text = extractTextFromTranscript({ items: delta.items });
    if (text) {
      return text;
    }
  }

  if (Array.isArray(delta.alternatives) && delta.alternatives.length > 0) {
    const text = delta.alternatives
      .map((alternative) => {
        if (!alternative) {
          return '';
        }

        if (typeof alternative === 'string' && alternative.trim()) {
          return alternative;
        }

        if (typeof alternative.text === 'string' && alternative.text.trim()) {
          return alternative.text;
        }

        return extractTextFromTranscript(alternative);
      })
      .filter(Boolean)
      .join(' ')
      .trim();

    if (text) {
      return text;
    }
  }

  if (Array.isArray(delta.content) && delta.content.length > 0) {
    const text = extractTextFromContent(delta.content);
    if (text.trim()) {
      return text;
    }
  }

  if (Array.isArray(delta.output) && delta.output.length > 0) {
    const text = delta.output
      .map((item) => extractTextFromContent(item?.content))
      .filter(Boolean)
      .join('');

    if (text.trim()) {
      return text;
    }
  }

  if (delta.segment) {
    const text = extractTextFromDelta(delta.segment);
    if (text.trim()) {
      return text;
    }
  }

  if (Array.isArray(delta.segments) && delta.segments.length > 0) {
    const text = delta.segments
      .map((segment) => {
        if (!segment) {
          return '';
        }

        if (typeof segment === 'string') {
          return segment;
        }

        if (typeof segment.text === 'string' && segment.text.trim()) {
          return segment.text;
        }

        return extractTextFromTranscript(segment);
      })
      .filter(Boolean)
      .join(' ')
      .trim();

    if (text) {
      return text;
    }
  }

  const responseText = extractTextFromResponse(delta.response || delta.result);
  if (responseText.trim()) {
    return responseText;
  }

  const fallback = collectTextFromStructure(delta, new Set(), false);
  const trimmed = fallback.trim();
  return trimmed ? fallback : '';
}

function extractTextFromEvent(event) {
  if (!event || typeof event !== 'object') {
    return '';
  }

  if (typeof event.text === 'string' && event.text.trim()) {
    return event.text;
  }

  if (Array.isArray(event.text) && event.text.length > 0) {
    const text = event.text
      .map((item) => (typeof item === 'string' ? item : extractTextFromDelta(item)))
      .filter(Boolean)
      .join('');

    if (text.trim()) {
      return text;
    }
  }

  if (typeof event.delta === 'string' && event.delta.trim()) {
    return event.delta;
  }

  const deltaText = extractTextFromDelta(event.delta);
  if (deltaText.trim()) {
    return deltaText;
  }

  if (typeof event.output_text === 'string' && event.output_text.trim()) {
    return event.output_text;
  }

  if (Array.isArray(event.output_text) && event.output_text.length > 0) {
    const text = event.output_text.filter((part) => typeof part === 'string').join('');
    if (text.trim()) {
      return text;
    }
  }

  if (event.segment && typeof event.segment.text === 'string' && event.segment.text.trim()) {
    return event.segment.text;
  }

  if (Array.isArray(event.segments)) {
    const text = event.segments
      .map((segment) => (segment && typeof segment.text === 'string' ? segment.text : ''))
      .filter(Boolean)
      .join(' ');

    if (text.trim()) {
      return text;
    }
  }

  if (event.transcript) {
    const text = extractTextFromTranscript(event.transcript);
    if (text) {
      return text;
    }
  }

  if (Array.isArray(event.transcripts) && event.transcripts.length > 0) {
    const text = event.transcripts
      .map((entry) => extractTextFromTranscript(entry))
      .filter(Boolean)
      .join(' ')
      .trim();

    if (text) {
      return text;
    }
  }

  if (event.item) {
    const text = extractTextFromTranscript(event.item);
    if (text) {
      return text;
    }
  }

  if (Array.isArray(event.items) && event.items.length > 0) {
    const text = extractTextFromTranscript({ items: event.items });
    if (text) {
      return text;
    }
  }

  const responseText = extractTextFromResponse(event.response || event.result);
  if (responseText.trim()) {
    return responseText;
  }

  if (Array.isArray(event.content)) {
    const text = extractTextFromContent(event.content);
    if (text.trim()) {
      return text;
    }
  }

  const fallback = collectTextFromStructure(event, new Set(), false);
  const trimmed = fallback.trim();
  return trimmed ? fallback : '';
}

module.exports = {
  appendTranscriptSegment,
  extractTextFromEvent,
  extractTextFromDelta,
  extractTextFromTranscript,
  shouldRewriteTranscript,
};
