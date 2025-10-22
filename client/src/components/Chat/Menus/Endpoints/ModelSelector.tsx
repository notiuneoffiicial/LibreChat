import React, { useMemo } from 'react';
import type * as t from 'librechat-data-provider';
import type { ModelSelectorProps } from '~/common';
import { ModelSelectorProvider, useModelSelectorContext } from './ModelSelectorContext';
import { ModelSelectorChatProvider } from './ModelSelectorChatContext';
import { renderModelSpecs, renderEndpoints, renderSearchResults } from './components';
import { getSelectedIcon, getDisplayValue } from './utils';
import { CustomMenu as Menu } from './CustomMenu';
import DialogManager from './DialogManager';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

function ModelSelectorContent() {
  const localize = useLocalize();

  const {
    // LibreChat
    agentsMap,
    modelSpecs,
    mappedEndpoints,
    endpointsConfig,
    isReadOnly,
    // State
    searchValue,
    searchResults,
    selectedValues,

    // Functions
    setSearchValue,
    setSelectedValues,
    // Dialog
    keyDialogOpen,
    onOpenChange,
    keyDialogEndpoint,
  } = useModelSelectorContext();

  const selectedIcon = useMemo(
    () =>
      getSelectedIcon({
        mappedEndpoints: mappedEndpoints ?? [],
        selectedValues,
        modelSpecs,
        endpointsConfig,
      }),
    [mappedEndpoints, selectedValues, modelSpecs, endpointsConfig],
  );

  const hiddenModelSpecNames = useMemo(
    () =>
      new Set(
        (modelSpecs ?? [])
          .filter((spec) => spec.preset?.model === 'deepseek-chat')
          .map((spec) => spec.name),
      ),
    [modelSpecs],
  );

  const displayedModelSpecs = useMemo(
    () =>
      (modelSpecs ?? []).filter((spec) => !hiddenModelSpecNames.has(spec.name)),
    [modelSpecs, hiddenModelSpecNames],
  );

  const filteredSearchResults = useMemo(() => {
    if (!searchResults) {
      return null;
    }

    return searchResults.filter((result) => {
      if ('preset' in result) {
        const spec = result as t.TModelSpec;
        return !hiddenModelSpecNames.has(spec.name);
      }

      return true;
    });
  }, [searchResults, hiddenModelSpecNames]);

  const optimismSpecNames = useMemo(
    () =>
      (modelSpecs ?? [])
        .filter((spec) => spec.preset?.endpoint === 'Deepseek')
        .map((spec) => spec.name),
    [modelSpecs],
  );

  const optimismModelIds = useMemo(
    () =>
      (modelSpecs ?? [])
        .filter((spec) => spec.preset?.endpoint === 'Deepseek')
        .map((spec) => spec.preset?.model)
        .filter((model): model is string => Boolean(model)),
    [modelSpecs],
  );

  const selectedDisplayValue = useMemo(() => {
    const baseDisplay = getDisplayValue({
      localize,
      agentsMap,
      modelSpecs,
      selectedValues,
      mappedEndpoints,
    });

    const matchesOptimism =
      (selectedValues.endpoint === 'Deepseek' &&
        ((selectedValues.modelSpec && optimismSpecNames.includes(selectedValues.modelSpec)) ||
          (selectedValues.model && optimismModelIds.includes(selectedValues.model)))) ||
      (selectedValues.model && optimismModelIds.includes(selectedValues.model));

    if (matchesOptimism) {
      return 'OptimismAI';
    }

    return baseDisplay;
  }, [
    localize,
    agentsMap,
    modelSpecs,
    selectedValues,
    mappedEndpoints,
    optimismModelIds,
    optimismSpecNames,
  ]);

  const trigger = (
    <button
      type="button"
      className={cn(
        'my-1 flex h-10 w-full max-w-[70vw] items-center justify-center gap-2 rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary',
        isReadOnly
          ? 'cursor-not-allowed opacity-60 hover:bg-surface-secondary'
          : 'hover:bg-surface-tertiary',
      )}
      aria-label={localize('com_ui_select_model')}
      disabled={isReadOnly}
    >
      {selectedIcon && React.isValidElement(selectedIcon) && (
        <div className="flex flex-shrink-0 items-center justify-center overflow-hidden">
          {selectedIcon}
        </div>
      )}
      <span className="flex-grow truncate text-left">{selectedDisplayValue}</span>
    </button>
  );

  return (
    <div className="relative flex w-full max-w-md flex-col items-center gap-2">
      <Menu
        values={selectedValues}
        disabled={isReadOnly}
        onValuesChange={(values: Record<string, any>) => {
          if (isReadOnly) {
            return;
          }

          setSelectedValues({
            endpoint: values.endpoint || '',
            model: values.model || '',
            modelSpec: values.modelSpec || '',
          });
        }}
        onSearch={isReadOnly ? undefined : (value) => setSearchValue(value)}
        combobox={
          isReadOnly ? undefined : <input placeholder={localize('com_endpoint_search_models')} />
        }
        trigger={trigger}
      >
        {filteredSearchResults ? (
          renderSearchResults(filteredSearchResults, localize, searchValue)
        ) : (
          <>
            {renderModelSpecs(displayedModelSpecs, selectedValues.modelSpec || '')}
            {renderEndpoints(mappedEndpoints ?? [])}
          </>
        )}
      </Menu>
      <DialogManager
        keyDialogOpen={keyDialogOpen}
        onOpenChange={onOpenChange}
        endpointsConfig={endpointsConfig || {}}
        keyDialogEndpoint={keyDialogEndpoint || undefined}
      />
    </div>
  );
}

export default function ModelSelector({ startupConfig }: ModelSelectorProps) {
  return (
    <ModelSelectorChatProvider>
      <ModelSelectorProvider startupConfig={startupConfig}>
        <ModelSelectorContent />
      </ModelSelectorProvider>
    </ModelSelectorChatProvider>
  );
}
