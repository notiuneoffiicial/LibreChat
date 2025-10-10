const NO_SYSTEM_MODEL_REGEX = /\b(o1-preview|o1-mini)\b/i;
const SECTION_SEPARATOR = '\n\n';

/**
 * @typedef {Object} ContextSection
 * @property {string} [id]
 * @property {string} [label]
 * @property {string} content
 */

/**
 * Composes the final instruction payload for chat completions.
 *
 * @param {Object} options
 * @param {string} [options.persona] - The base persona/system prompt from the preset.
 * @param {ContextSection[]} [options.contextSections] - Dynamic context blocks such as retrieved files.
 * @param {string} [options.model] - The model identifier, used to detect models without system-message support.
 * @returns {{
 *   instructions: string,
 *   systemContent: string | null,
 *   userPrepend: string | null,
 *   sections: { persona: string | null, context: ContextSection[] }
 * }}
 */
function composePrompt({ persona = '', contextSections = [], model } = {}) {
  const personaText = typeof persona === 'string' ? persona.trim() : '';

  const contextText = contextSections
    .map((section) => (typeof section?.content === 'string' ? section.content.trim() : ''))
    .filter(Boolean)
    .join(SECTION_SEPARATOR);

  const pieces = [];

  if (contextText) {
    pieces.push(contextText);
  }

  if (personaText) {
    pieces.push(personaText);
  }

  const combined = pieces.join(SECTION_SEPARATOR).trim();
  if (!combined) {
    return {
      instructions: '',
      systemContent: null,
      userPrepend: null,
      sections: { persona: personaText || null, context: contextSections },
    };
  }

  const withLabel = `Instructions:\n${combined}`;
  const noSystemModel = model ? NO_SYSTEM_MODEL_REGEX.test(model) : false;

  return {
    instructions: combined,
    systemContent: noSystemModel ? null : withLabel,
    userPrepend: noSystemModel ? withLabel : null,
    sections: { persona: personaText || null, context: contextSections },
  };
}

module.exports = composePrompt;
