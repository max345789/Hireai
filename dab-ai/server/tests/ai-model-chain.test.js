const test = require('node:test');
const assert = require('node:assert/strict');

const servicePath = require.resolve('../services/claudeService');

function loadServiceWithEnv(overrides) {
  const previous = {
    AI_MODEL_CHAIN: process.env.AI_MODEL_CHAIN,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };

  Object.assign(process.env, overrides);
  delete require.cache[servicePath];
  const service = require('../services/claudeService');

  return {
    service,
    restore() {
      for (const [key, value] of Object.entries(previous)) {
        if (value == null) delete process.env[key];
        else process.env[key] = value;
      }
      delete require.cache[servicePath];
    },
  };
}

test('getConfiguredAiModels returns ordered configured providers', () => {
  const { service, restore } = loadServiceWithEnv({
    AI_MODEL_CHAIN: 'gemini,openai,claude',
    GEMINI_API_KEY: 'g-key',
    OPENAI_API_KEY: 'o-key',
    ANTHROPIC_API_KEY: 'a-key',
  });

  try {
    const models = service.getConfiguredAiModels();
    assert.deepEqual(models.map((item) => item.provider), ['gemini', 'openai', 'claude']);
  } finally {
    restore();
  }
});

test('getConfiguredAiModels skips providers without keys', () => {
  const { service, restore } = loadServiceWithEnv({
    AI_MODEL_CHAIN: 'claude,openai,gemini',
    ANTHROPIC_API_KEY: '',
    OPENAI_API_KEY: 'o-key',
    GEMINI_API_KEY: '',
  });

  try {
    const models = service.getConfiguredAiModels();
    assert.deepEqual(models.map((item) => item.provider), ['openai']);
  } finally {
    restore();
  }
});
