import React, { memo, useMemo } from 'react';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import supersub from 'remark-supersub';
import rehypeKatex from 'rehype-katex';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkDirective from 'remark-directive';
import type { Pluggable } from 'unified';
import { Citation, CompositeCitation, HighlightedText } from '~/components/Web/Citation';
import { Artifact, artifactPlugin } from '~/components/Artifacts/Artifact';
import { ArtifactProvider, CodeBlockProvider } from '~/Providers';
import MarkdownErrorBoundary from './MarkdownErrorBoundary';
import { langSubset, preprocessLaTeX } from '~/utils';
import { unicodeCitation } from '~/components/Web';
import { code, a, p } from './MarkdownComponents';
import { useRecoilValue } from 'recoil';
import store from '~/store';

type TContentProps = {
  content: string;
  isLatestMessage: boolean;
};

const Markdown = memo(({ content = '', isLatestMessage }: TContentProps) => {
  const isInitializing = content === '';
  const latexParsingEnabled = useRecoilValue(store.latexParsing);

  const currentContent = useMemo(() => {
    if (isInitializing) {
      return '';
    }

    return latexParsingEnabled ? preprocessLaTeX(content) : content;
  }, [content, isInitializing, latexParsingEnabled]);

  const rehypePlugins = useMemo(() => {
    const plugins: Pluggable[] = [
      [
        rehypeHighlight,
        {
          detect: true,
          ignoreMissing: true,
          subset: langSubset,
        },
      ],
    ];

    if (latexParsingEnabled) {
      plugins.unshift([rehypeKatex]);
    }

    return plugins;
  }, [latexParsingEnabled]);

  const remarkPlugins: Pluggable[] = useMemo(() => {
    const basePlugins: Pluggable[] = [
      supersub,
      remarkGfm,
      remarkDirective,
      artifactPlugin,
      unicodeCitation,
    ];

    if (latexParsingEnabled) {
      basePlugins.push([remarkMath, { singleDollarTextMath: false }]);
    }

    return basePlugins;
  }, [latexParsingEnabled]);

  if (isInitializing) {
    return (
      <div className="absolute">
        <p className="relative">
          <span className={isLatestMessage ? 'result-thinking' : ''} />
        </p>
      </div>
    );
  }

  return (
    <MarkdownErrorBoundary content={content} codeExecution={true}>
      <ArtifactProvider>
        <CodeBlockProvider>
          <ReactMarkdown
            /** @ts-ignore */
            remarkPlugins={remarkPlugins}
            /* @ts-ignore */
            rehypePlugins={rehypePlugins}
            components={
              {
                code,
                a,
                p,
                artifact: Artifact,
                citation: Citation,
                'highlighted-text': HighlightedText,
                'composite-citation': CompositeCitation,
              } as {
                [nodeType: string]: React.ElementType;
              }
            }
          >
            {currentContent}
          </ReactMarkdown>
        </CodeBlockProvider>
      </ArtifactProvider>
    </MarkdownErrorBoundary>
  );
});

export default Markdown;
