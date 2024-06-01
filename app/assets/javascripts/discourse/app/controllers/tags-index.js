import Controller from "@ember/controller";
import { action } from "@ember/object";
import { alias, notEmpty } from "@ember/object/computed";
import { service } from "@ember/service";
import TagUpload from "discourse/components/modal/tag-upload";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default Controller.extend({
  dialog: service(),
  modal: service(),
  sortedByCount: true,
  sortedByName: false,
  sortAlphabetically: alias("siteSettings.tags_sort_alphabetically"),
  canAdminTags: alias("currentUser.staff"),
  groupedByCategory: notEmpty("model.extras.categories"),
  groupedByTagGroup: notEmpty("model.extras.tag_groups"),

  init() {
    this._super(...arguments);

    const isAlphaSort = this.sortAlphabetically;

    this.setProperties({
      sortedByCount: isAlphaSort ? false : true,
      sortedByName: isAlphaSort ? true : false,
      sortProperties: isAlphaSort ? ["id"] : ["totalCount:desc", "id"],
    });
  },

  @discourseComputed("groupedByCategory", "groupedByTagGroup")
  otherTagsTitleKey(groupedByCategory, groupedByTagGroup) {
    if (!groupedByCategory && !groupedByTagGroup) {
      return "tagging.all_tags";
    } else {
      return "tagging.other_tags";
    }
  },

  @discourseComputed
  actionsMapping() {
    return {
      manageGroups: () => this.send("showTagGroups"),
      uploadTags: () => this.send("showUploader"),
      deleteUnusedTags: () => this.send("deleteUnused"),
    };
  },

  @action
  sortByCount(event) {
    event?.preventDefault();
    this.setProperties({
      sortProperties: ["totalCount:desc", "id"],
      sortedByCount: true,
      sortedByName: false,
    });
  },

  @action
  sortById(event) {
    event?.preventDefault();
    this.setProperties({
      sortProperties: ["id"],
      sortedByCount: false,
      sortedByName: true,
    });
  },

  actions: {
    showUploader() {
      this.modal.show(TagUpload);
    },

    deleteUnused() {
      ajax("/tags/unused", { type: "GET" })
        .then((result) => {
          const displayN = 20;
          const tags = result["tags"];

          if (tags.length === 0) {
            this.dialog.alert(I18n.t("tagging.delete_no_unused_tags"));
            return;
          }

          const joinedTags = tags
            .slice(0, displayN)
            .join(I18n.t("tagging.tag_list_joiner"));
          const more = Math.max(0, tags.length - displayN);

          const tagsString =
            more === 0
              ? joinedTags
              : I18n.t("tagging.delete_unused_confirmation_more_tags", {
                  count: more,
                  tags: joinedTags,
                });

          const message = I18n.t("tagging.delete_unused_confirmation", {
            count: tags.length,
            tags: tagsString,
          });

          this.dialog.deleteConfirm({
            message,
            confirmButtonLabel: "tagging.delete_unused",
            didConfirm: () => {
              return ajax("/tags/unused", { type: "DELETE" })
                .then(() => this.send("triggerRefresh"))
                .catch(popupAjaxError);
            },
          });
        })
        .catch(popupAjaxError);
    },
  },
});
