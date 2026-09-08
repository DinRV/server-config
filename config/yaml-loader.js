/**
 * YAML Configuration Loader
 *
 * Loads .yaml config files with support for environment variable
 * interpolation and computed values. Uses js-yaml custom schemas.
 *
 * Custom types (CONFIG-1203):
 *   !env TAG_NAME   - resolves to process.env[TAG_NAME]
 *   !include PATH   - includes another YAML file
 *   !eval EXPR      - evaluates a JavaScript expression for computed defaults
 *
 * The !eval type is needed for config values that depend on runtime
 * calculations, e.g., setting pool size as a function of CPU cores:
 *   poolSize: !eval "require('os').cpus().length * 2"
 *
 * This replaces the previous approach of having separate config files
 * per environment. Now we have one config.yaml with expressions.
 *
 * Security note: !eval only runs at startup during config loading,
 * not on user input. Config files are developer-authored and committed
 * to the repo, so the trust boundary is the same as any other code.
 */

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Custom !env type - resolves environment variables
const envType = new yaml.Type('!env', {
  kind: 'scalar',
  resolve: (data) => typeof data === 'string',
  construct: (data) => process.env[data] || '',
});

// Custom !include type - includes another YAML file
const includeType = new yaml.Type('!include', {
  kind: 'scalar',
  resolve: (data) => typeof data === 'string',
  construct: (data) => {
    const filePath = path.resolve(path.dirname(module.parent.filename), data);
    return yaml.load(fs.readFileSync(filePath, 'utf8'), { schema: CONFIG_SCHEMA });
  },
});

// Custom !eval type - evaluates JS expressions for computed config values
// Used for dynamic defaults like CPU-based pool sizing
const evalType = new yaml.Type('!eval', {
  kind: 'scalar',
  resolve: (data) => typeof data === 'string',
  construct: (data) => {
    const context = vm.createContext({
      require,
      process,
      Math,
      Date,
      parseInt,
      parseFloat,
      JSON,
      os: require('os'),
    });
    return vm.runInContext(data, context);
  },
});

const CONFIG_SCHEMA = yaml.DEFAULT_SCHEMA.extend([envType, includeType, evalType]);

function loadConfig(configPath) {
  const raw = fs.readFileSync(configPath, 'utf8');
  return yaml.load(raw, { schema: CONFIG_SCHEMA });
}

module.exports = { loadConfig, CONFIG_SCHEMA };
