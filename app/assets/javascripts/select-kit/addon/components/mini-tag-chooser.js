import { computed } from "@ember/object";
import { empty, or } from "@ember/object/computed";
import { setting } from "discourse/lib/computed";
import { makeArray } from "discourse-common/lib/helpers";
import I18n from "discourse-i18n";
import MultiSelectComponent from "select-kit/components/multi-select";
import TagsMixin from "select-kit/mixins/tags";

export default MultiSelectComponent.extend(TagsMixin, {
  pluginApiIdentifiers: ["mini-tag-chooser"],
  attributeBindings: ["selectKit.options.categoryId:category-id"],
  classNames: ["mini-tag-chooser"],
  classNameBindings: ["noTags"],
  noTags: empty("value"),
  maxTagSearchResults: setting("max_tag_search_results"),
  maxTagsPerTopic: setting("max_tags_per_topic"),

  selectKitOptions: {
    fullWidthOnMobile: true,
    filterable: true,
    caretDownIcon: "caretIcon",
    caretUpIcon: "caretIcon",
    termMatchesForbidden: false,
    categoryId: null,
    everyTag: false,
    closeOnChange: false,
    maximum: "maxTagsPerTopic",
    autoInsertNoneItem: false,
    useHeaderFilter: false,
  },

  modifyComponentForRow(collection, item) {
    if (this.getValue(item) === this.selectKit.filter && !item.count) {
      return "select-kit/select-kit-row";
    }

    return "tag-row";
  },

  modifyNoSelection() {
    if (this.selectKit.options.minimum > 0) {
      return this.defaultItem(
        null,
        I18n.t("tagging.choose_for_topic_required", {
          count: this.selectKit.options.minimum,
        })
      );
    } else {
      return this.defaultItem(null, I18n.t("tagging.choose_for_topic"));
    }
  },

  allowAnyTag: or("allowCreate", "site.can_create_tag"),

  caretIcon: computed("value.[]", "content.[]", function () {
    const maximum = this.selectKit.options.maximum;
    return maximum && makeArray(this.value).length >= parseInt(maximum, 10)
      ? null
      : "plus";
  }),

  content: computed("value.[]", function () {
    let values = makeArray(this.value);
    if (this.selectKit.options.hiddenValues) {
      values = values.filter(
        (val) => !this.selectKit.options.hiddenValues.includes(val)
      );
    }
    return values.map((x) => this.defaultItem(x, x));
  }),

  search(filter) {
    const maximum = this.selectKit.options.maximum;
    if (maximum === 0) {
      const key = "select_kit.max_content_reached";
      this.addError(I18n.t(key, { count: maximum }));
      return [];
    }

    const data = {
      q: filter || "",
      limit: this.maxTagSearchResults,
      categoryId: this.selectKit.options.categoryId,
    };

    if (this.value) {
      data.selected_tags = this.value.slice(0, 100);
    }

    if (!this.selectKit.options.everyTag) {
      data.filterForInput = true;
    }

    return this.searchTags("/tags/filter/search", data, this._transformJson);
  },

  _transformJson(context, json) {
    if (context.isDestroyed || context.isDestroying) {
      return [];
    }

    let results = json.results;

    context.setProperties({
      termMatchesForbidden: json.forbidden ? true : false,
      termMatchErrorMessage: json.forbidden_message,
    });

    if (context.siteSettings.tags_sort_alphabetically) {
      results = results.sort((a, b) => a.text.localeCompare(b.text));
    }

    if (json.required_tag_group) {
      context.set(
        "selectKit.options.translatedFilterPlaceholder",
        I18n.t("tagging.choose_for_topic_required_group", {
          count: json.required_tag_group.min_count,
          name: json.required_tag_group.name,
        })
      );
    } else {
      context.set("selectKit.options.translatedFilterPlaceholder", null);
    }

    return results.filter((r) => !makeArray(context.tags).includes(r.id));
  },
});
