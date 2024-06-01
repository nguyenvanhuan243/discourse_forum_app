import { tracked } from "@glimmer/tracking";
import Component from "@ember/component";
import { dependentKeyCompat } from "@ember/object/compat";
import { filterTypeForMode } from "discourse/lib/filter-mode";
import discourseComputed from "discourse-common/utils/decorators";

export default Component.extend({
  tagName: "li",
  classNameBindings: [
    "active",
    "content.hasIcon:has-icon",
    "content.classNames",
    "isHidden:hidden",
    "content.name",
  ],
  attributeBindings: ["content.title:title"],
  hidden: false,
  activeClass: "",
  hrefLink: null,
  filterMode: tracked(),

  @dependentKeyCompat
  get filterType() {
    return filterTypeForMode(this.filterMode);
  },

  @discourseComputed("content.filterType", "filterType", "content.active")
  active(contentFilterType, filterType, active) {
    if (active !== undefined) {
      return active;
    }
    return contentFilterType === filterType;
  },

  @discourseComputed("content.count", "content.name")
  isHidden(count, name) {
    return (
      !this.active &&
      this.currentUser &&
      !this.currentUser.new_new_view_enabled &&
      this.currentUser.trust_level > 0 &&
      (name === "new" || name === "unread") &&
      count < 1
    );
  },

  didReceiveAttrs() {
    this._super(...arguments);
    const content = this.content;

    let href = content.get("href");
    let urlSearchParams = new URLSearchParams();
    let addParamsEvenIfEmpty = false;

    // Include the category id if the option is present
    if (content.get("includeCategoryId")) {
      let categoryId = this.get("content.category.id");
      if (categoryId) {
        urlSearchParams.set("category_id", categoryId);
      }
    }

    // To reset the "filter" sticky param, at least one query param is needed.
    // If no query param is present, add an empty one to ensure a ? is
    // appended to the URL.
    if (content.currentRouteQueryParams) {
      if (content.currentRouteQueryParams.filter) {
        addParamsEvenIfEmpty = true;
      }

      if (content.currentRouteQueryParams.f) {
        urlSearchParams.set("f", content.currentRouteQueryParams.f);
      }
    }

    if (
      this.siteSettings.desktop_category_page_style ===
      "categories_and_latest_topics_created_date"
    ) {
      urlSearchParams.set("order", "created");
    }

    const queryString = urlSearchParams.toString();
    if (addParamsEvenIfEmpty || queryString) {
      href += `?${queryString}`;
    }
    this.set("hrefLink", href);

    this.set("activeClass", this.active ? "active" : "");
  },
});
