import Component from "@ember/component";
import { action } from "@ember/object";
import { and, reads } from "@ember/object/computed";
import { service } from "@ember/service";
import { htmlSafe } from "@ember/template";
import { isEmpty } from "@ember/utils";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default Component.extend({
  dialog: service(),
  tagName: "",
  loading: false,
  tagInfo: null,
  newSynonyms: null,
  showEditControls: false,
  canAdminTag: reads("currentUser.staff"),
  editSynonymsMode: and("canAdminTag", "showEditControls"),
  editing: false,
  newTagName: null,
  newTagDescription: null,
  router: service(),

  @discourseComputed("tagInfo.tag_group_names")
  tagGroupsInfo(tagGroupNames) {
    return I18n.t("tagging.tag_groups_info", {
      count: tagGroupNames.length,
      tag_groups: tagGroupNames.join(", "),
    });
  },

  @discourseComputed("tagInfo.categories")
  categoriesInfo(categories) {
    return I18n.t("tagging.category_restrictions", {
      count: categories.length,
    });
  },

  @discourseComputed(
    "tagInfo.tag_group_names",
    "tagInfo.categories",
    "tagInfo.synonyms"
  )
  nothingToShow(tagGroupNames, categories, synonyms) {
    return isEmpty(tagGroupNames) && isEmpty(categories) && isEmpty(synonyms);
  },

  @discourseComputed("newTagName")
  updateDisabled(newTagName) {
    const filterRegexp = new RegExp(this.site.tags_filter_regexp, "g");
    newTagName = newTagName ? newTagName.replace(filterRegexp, "").trim() : "";
    return newTagName.length === 0;
  },

  didInsertElement() {
    this._super(...arguments);
    this.loadTagInfo();
  },

  loadTagInfo() {
    if (this.loading) {
      return;
    }
    this.set("loading", true);
    return this.store
      .find("tag-info", this.tag.id)
      .then((result) => {
        this.set("tagInfo", result);
        this.set(
          "tagInfo.synonyms",
          result.synonyms.map((s) => this.store.createRecord("tag", s))
        );
      })
      .finally(() => this.set("loading", false))
      .catch(popupAjaxError);
  },

  @action
  edit(event) {
    event?.preventDefault();
    this.tagInfo.set(
      "descriptionWithNewLines",
      this.tagInfo.description?.replaceAll("<br>", "\n")
    );
    this.setProperties({
      editing: true,
      newTagName: this.tag.id,
      newTagDescription: this.tagInfo.description,
    });
  },

  @action
  unlinkSynonym(tag, event) {
    event?.preventDefault();
    ajax(`/tag/${this.tagInfo.name}/synonyms/${tag.id}`, {
      type: "DELETE",
    })
      .then(() => this.tagInfo.synonyms.removeObject(tag))
      .catch(popupAjaxError);
  },

  @action
  deleteSynonym(tag, event) {
    event?.preventDefault();

    this.dialog.yesNoConfirm({
      message: I18n.t("tagging.delete_synonym_confirm", {
        tag_name: tag.text,
      }),
      didConfirm: () => {
        return tag
          .destroyRecord()
          .then(() => this.tagInfo.synonyms.removeObject(tag))
          .catch(popupAjaxError);
      },
    });
  },

  @action
  toggleEditControls() {
    this.toggleProperty("showEditControls");
  },

  @action
  cancelEditing() {
    this.set("editing", false);
  },

  @action
  finishedEditing() {
    const oldTagName = this.tag.id;
    this.newTagDescription = this.newTagDescription?.replaceAll("\n", "<br>");
    this.tag
      .update({ id: this.newTagName, description: this.newTagDescription })
      .then((result) => {
        this.set("editing", false);
        this.tagInfo.set("description", this.newTagDescription);
        if (
          result.responseJson.tag &&
          oldTagName !== result.responseJson.tag.id
        ) {
          this.router.transitionTo("tag.show", result.responseJson.tag.id);
        }
      })
      .catch(popupAjaxError);
  },

  @action
  deleteTag() {
    const numTopics =
      this.get("list.topic_list.tags.firstObject.topic_count") || 0;

    let confirmText =
      numTopics === 0
        ? I18n.t("tagging.delete_confirm_no_topics")
        : I18n.t("tagging.delete_confirm", { count: numTopics });

    if (this.tagInfo.synonyms.length > 0) {
      confirmText +=
        " " +
        I18n.t("tagging.delete_confirm_synonyms", {
          count: this.tagInfo.synonyms.length,
        });
    }

    this.dialog.deleteConfirm({
      message: confirmText,
      didConfirm: async () => {
        try {
          await this.tag.destroyRecord();
          this.router.transitionTo("tags.index");
        } catch {
          this.dialog.alert(I18n.t("generic_error"));
        }
      },
    });
  },

  @action
  addSynonyms() {
    this.dialog.confirm({
      message: htmlSafe(
        I18n.t("tagging.add_synonyms_explanation", {
          count: this.newSynonyms.length,
          tag_name: this.tagInfo.name,
        })
      ),
      didConfirm: () => {
        return ajax(`/tag/${this.tagInfo.name}/synonyms`, {
          type: "POST",
          data: {
            synonyms: this.newSynonyms,
          },
        })
          .then((response) => {
            if (response.success) {
              this.set("newSynonyms", null);
              this.loadTagInfo();
            } else if (response.failed_tags) {
              this.dialog.alert(
                I18n.t("tagging.add_synonyms_failed", {
                  tag_names: Object.keys(response.failed_tags).join(", "),
                })
              );
            } else {
              this.dialog.alert(I18n.t("generic_error"));
            }
          })
          .catch(popupAjaxError);
      },
    });
  },
});
