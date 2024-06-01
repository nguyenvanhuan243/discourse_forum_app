import {
  getComponentTemplate,
  hasInternalComponentManager,
  setComponentTemplate,
} from "@glimmer/manager";
import templateOnly from "@ember/component/template-only";
import deprecated from "discourse-common/lib/deprecated";
import { buildRawConnectorCache } from "discourse-common/lib/raw-templates";

let _connectorCache;
let _rawConnectorCache;
let _extraConnectorClasses = {};
let _extraConnectorComponents = {};

export function resetExtraClasses() {
  _extraConnectorClasses = {};
  _extraConnectorComponents = {};
}

// Note: In plugins, define a class by path and it will be wired up automatically
// eg: discourse/connectors/<OUTLET NAME>/<CONNECTOR NAME>
export function extraConnectorClass(name, obj) {
  deprecated(
    "Defining connector classes via registerConnectorClass is deprecated. See https://meta.discourse.org/t/32727 for more modern patterns.",
    { id: "discourse.register-connector-class-legacy" }
  );
  _extraConnectorClasses[name] = obj;
}

export function extraConnectorComponent(outletName, klass) {
  if (!hasInternalComponentManager(klass)) {
    throw new Error("klass is not an Ember component");
  }
  if (!getComponentTemplate(klass)) {
    throw new Error(
      "connector component has no associated template. Ensure the template is colocated or authored with gjs."
    );
  }
  if (outletName.includes("/")) {
    throw new Error("invalid outlet name");
  }
  _extraConnectorComponents[outletName] ??= [];
  _extraConnectorComponents[outletName].push(klass);
}

const OUTLET_REGEX =
  /^discourse(\/[^\/]+)*?(?<template>\/templates)?\/connectors\/(?<outlet>[^\/]+)\/(?<name>[^\/\.]+)$/;

function findOutlets(keys, callback) {
  return keys.forEach((res) => {
    const match = res.match(OUTLET_REGEX);
    if (match) {
      callback({
        outletName: match.groups.outlet,
        connectorName: match.groups.name,
        moduleName: res,
        isTemplate: !!match.groups.template,
      });
    }
  });
}

export function clearCache() {
  _connectorCache = null;
  _rawConnectorCache = null;
}

/**
 * Sets component template, ignoring errors if it's already set to the same template
 */
function safeSetComponentTemplate(template, component) {
  try {
    setComponentTemplate(template, component);
  } catch (e) {
    if (getComponentTemplate(component) !== template) {
      throw e;
    }
  }
}

/**
 * Clear the cache of connectors. Should only be used in tests when
 * `requirejs.entries` is changed.
 */
export function expireConnectorCache() {
  _connectorCache = null;
}

class ConnectorInfo {
  #componentClass;
  #templateOnly;

  constructor(outletName, connectorName) {
    this.outletName = outletName;
    this.connectorName = connectorName;
  }

  get componentClass() {
    return (this.#componentClass ??= this.#buildComponentClass());
  }

  get templateOnly() {
    return (this.#templateOnly ??= this.#buildTemplateOnlyClass());
  }

  get classicClassNames() {
    return `${this.outletName}-outlet ${this.connectorName}`;
  }

  get connectorClass() {
    if (this.classModule) {
      return this.classModule;
    } else if (this.classModuleName) {
      return require(this.classModuleName).default;
    } else {
      return _extraConnectorClasses[`${this.outletName}/${this.connectorName}`];
    }
  }

  get template() {
    if (this.templateModule) {
      return require(this.templateModule).default;
    }
  }

  get humanReadableName() {
    return `${this.outletName}/${this.connectorName} (${
      this.classModuleName || this.templateModule
    })`;
  }

  #buildComponentClass() {
    const klass = this.connectorClass;
    if (klass && hasInternalComponentManager(klass)) {
      if (this.template) {
        safeSetComponentTemplate(this.template, klass);
      }
      this.#warnUnusableHooks();
      return klass;
    } else {
      return false;
    }
  }

  #buildTemplateOnlyClass() {
    const component = templateOnly();
    setComponentTemplate(this.template, component);
    this.#warnUnusableHooks();
    return component;
  }

  #warnUnusableHooks() {
    for (const methodName of [
      "actions",
      "setupComponent",
      "teardownComponent",
    ]) {
      if (this.connectorClass?.[methodName]) {
        deprecated(
          `actions, setupComponent and teardownComponent hooks cannot be used with Glimmer plugin outlets. Define a component class instead. (${this.outletName}/${this.connectorName}).`,
          { id: "discourse.plugin-outlet-classic-hooks" }
        );
      }
    }
  }
}

function buildConnectorCache() {
  _connectorCache = {};

  const outletsByModuleName = {};
  findOutlets(
    Object.keys(require.entries),
    ({ outletName, connectorName, moduleName, isTemplate }) => {
      let key = isTemplate
        ? moduleName.replace("/templates/", "/")
        : moduleName;

      let info = (outletsByModuleName[key] ??= new ConnectorInfo(
        outletName,
        connectorName
      ));

      if (isTemplate) {
        info.templateModule = moduleName;
      } else {
        info.classModuleName = moduleName;
      }
    }
  );

  for (const info of Object.values(outletsByModuleName)) {
    _connectorCache[info.outletName] ??= [];
    _connectorCache[info.outletName].push(info);
  }

  for (const [outletName, components] of Object.entries(
    _extraConnectorComponents
  )) {
    for (const klass of components) {
      const info = new ConnectorInfo(outletName);
      info.classModule = klass;

      _connectorCache[info.outletName] ??= [];
      _connectorCache[info.outletName].push(info);
    }
  }
}

export function connectorsExist(outletName) {
  if (!_connectorCache) {
    buildConnectorCache();
  }
  return Boolean(_connectorCache[outletName]);
}

export function connectorsFor(outletName) {
  if (!_connectorCache) {
    buildConnectorCache();
  }
  return _connectorCache[outletName] || [];
}

export function renderedConnectorsFor(outletName, args, context) {
  return connectorsFor(outletName).filter((con) => {
    const shouldRender = con.connectorClass?.shouldRender;
    return !shouldRender || shouldRender(args, context);
  });
}

export function rawConnectorsFor(outletName) {
  if (!_rawConnectorCache) {
    _rawConnectorCache = buildRawConnectorCache();
  }
  return _rawConnectorCache[outletName] || [];
}

export function buildArgsWithDeprecations(args, deprecatedArgs) {
  const output = {};

  Object.keys(args).forEach((key) => {
    Object.defineProperty(output, key, { value: args[key] });
  });

  Object.keys(deprecatedArgs).forEach((key) => {
    Object.defineProperty(output, key, {
      get() {
        deprecated(`${key} is deprecated`, {
          id: "discourse.plugin-connector.deprecated-arg",
        });

        return deprecatedArgs[key];
      },
    });
  });

  return output;
}
