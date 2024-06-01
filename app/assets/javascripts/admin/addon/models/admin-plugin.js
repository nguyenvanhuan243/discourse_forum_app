import { cached, tracked } from "@glimmer/tracking";
import { capitalize } from "@ember/string";
import I18n from "discourse-i18n";

export default class AdminPlugin {
  static create(args = {}) {
    return new AdminPlugin(args);
  }

  @tracked enabled;

  constructor(args = {}) {
    this.about = args.about;
    this.adminRoute = args.admin_route;
    this.commitHash = args.commit_hash;
    this.commitUrl = args.commit_url;
    this.enabled = args.enabled;
    this.enabledSetting = args.enabled_setting;
    this.hasSettings = args.has_settings;
    this.hasOnlyEnabledSetting = args.has_only_enabled_setting;
    this.id = args.id;
    this.isOfficial = args.is_official;
    this.isDiscourseOwned = args.is_discourse_owned;
    this.label = args.label;
    this.name = args.name;
    this.url = args.url;
    this.version = args.version;
    this.metaUrl = args.meta_url;
    this.authors = args.authors;
    this.extras = args.extras;
  }

  get useNewShowRoute() {
    return this.adminRoute?.use_new_show_route;
  }

  get snakeCaseName() {
    return this.name.replaceAll("-", "_");
  }

  get translatedCategoryName() {
    // We do this because the site setting list is grouped by category,
    // with plugins that have their root site setting key defined as `plugins:`
    // being grouped under the generic "plugins" category.
    //
    // If a site setting has defined a proper root key and translated category name,
    // we can use that instead to go directly to the setting category.
    //
    // Over time, no plugins should be missing this data.
    return I18n.lookup(`admin.site_settings.categories.${this.snakeCaseName}`);
  }

  get settingCategoryName() {
    if (this.translatedCategoryName) {
      return this.snakeCaseName;
    }

    return "plugins";
  }

  @cached
  get nameTitleized() {
    // The category name is better in a lot of cases, as it's a human-inputted
    // translation, and we can handle things like SAML instead of showing them
    // as Saml from discourse-saml. We can fall back to the programmatic version
    // though if needed.
    let name;
    if (this.translatedCategoryName) {
      name = this.translatedCategoryName;
    } else {
      name = this.name
        .split("-")
        .map((word) => {
          return capitalize(word);
        })
        .join(" ");
    }

    // Cuts down on repetition.
    const discoursePrefix = "Discourse ";
    if (name.startsWith(discoursePrefix)) {
      name = name.slice(discoursePrefix.length);
    }

    return name;
  }

  @cached
  get nameTitleizedLower() {
    return this.nameTitleized.toLowerCase();
  }

  get author() {
    if (this.isOfficial || this.isDiscourseOwned) {
      return I18n.t("admin.plugins.author", { author: "Discourse" });
    }

    return I18n.t("admin.plugins.author", { author: this.authors });
  }

  get linkUrl() {
    return this.metaUrl || this.url;
  }
}
