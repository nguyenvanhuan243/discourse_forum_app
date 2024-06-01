import * as GlimmerManager from "@glimmer/manager";
import ClassicComponent from "@ember/component";
import { isTesting } from "discourse-common/config/environment";
import DiscourseTemplateMap from "discourse-common/lib/discourse-template-map";

const COLOCATED_TEMPLATE_OVERRIDES = new Map();

let THROW_GJS_ERROR = isTesting();

/** For use in tests/integration/component-templates-test only */
export function overrideThrowGjsError(value) {
  THROW_GJS_ERROR = value;
}

// This patch is not ideal, but Ember does not allow us to change a component template after initial association
// https://github.com/glimmerjs/glimmer-vm/blob/03a4b55c03/packages/%40glimmer/manager/lib/public/template.ts#L14-L20
const originalGetTemplate = GlimmerManager.getComponentTemplate;
// eslint-disable-next-line no-import-assign
GlimmerManager.getComponentTemplate = (component) => {
  return (
    COLOCATED_TEMPLATE_OVERRIDES.get(component) ??
    originalGetTemplate(component)
  );
};

export default {
  after: ["populate-template-map", "mobile"],

  initialize(owner) {
    this.site = owner.lookup("service:site");

    this.eachThemePluginTemplate((templateKey, moduleNames, mobile) => {
      if (!mobile && DiscourseTemplateMap.coreTemplates.has(templateKey)) {
        // It's a non-colocated core component. Template will be overridden at runtime.
        return;
      }

      let componentName = templateKey;
      if (mobile) {
        componentName = componentName.slice("mobile/".length);
      }
      componentName = componentName.slice("components/".length);

      const component = owner.resolveRegistration(`component:${componentName}`);

      if (!component) {
        // Plugin/theme component template with no backing class.
        // Treat as classic component to emulate pre-template-only-glimmer-component behaviour.
        owner.register(`component:${componentName}`, ClassicComponent);
        return;
      }

      const originalTemplate = originalGetTemplate(component);
      const isStrictMode = originalTemplate?.()?.parsedLayout?.isStrictMode;
      const finalOverrideModuleName = moduleNames[moduleNames.length - 1];

      if (isStrictMode) {
        const message =
          `[${finalOverrideModuleName}] ${componentName} was authored using gjs and its template cannot be overridden. ` +
          `Ignoring override. For more information on the future of template overrides, see https://meta.discourse.org/t/247487`;
        if (THROW_GJS_ERROR) {
          throw new Error(message);
        } else {
          // eslint-disable-next-line no-console
          console.error(message);
        }
      } else if (originalTemplate) {
        const overrideTemplate = require(finalOverrideModuleName).default;

        COLOCATED_TEMPLATE_OVERRIDES.set(component, overrideTemplate);
      }
    });
  },

  eachThemePluginTemplate(cb) {
    const { coreTemplates, pluginTemplates, themeTemplates } =
      DiscourseTemplateMap;

    const orderedOverrides = [
      [pluginTemplates, "components/", false],
      [themeTemplates, "components/", false],
    ];

    if (this.site.mobileView) {
      orderedOverrides.push(
        [coreTemplates, "mobile/components/", true],
        [pluginTemplates, "mobile/components/", true],
        [themeTemplates, "mobile/components/", true]
      );
    }

    for (const [map, prefix, mobile] of orderedOverrides) {
      for (const [key, value] of map) {
        if (key.startsWith(prefix)) {
          cb(key, value, mobile);
        }
      }
    }
  },

  teardown() {
    COLOCATED_TEMPLATE_OVERRIDES.clear();
  },
};
