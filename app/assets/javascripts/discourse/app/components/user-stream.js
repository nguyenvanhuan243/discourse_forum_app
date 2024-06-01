import { getOwner } from "@ember/application";
import Component from "@ember/component";
import { on } from "@ember/object/evented";
import { later } from "@ember/runloop";
import { service } from "@ember/service";
import $ from "jquery";
import { popupAjaxError } from "discourse/lib/ajax-error";
import ClickTrack from "discourse/lib/click-track";
import DiscourseURL from "discourse/lib/url";
import LoadMore from "discourse/mixins/load-more";
import { NEW_TOPIC_KEY } from "discourse/models/composer";
import Draft from "discourse/models/draft";
import Post from "discourse/models/post";
import I18n from "discourse-i18n";

export default Component.extend(LoadMore, {
  tagName: "ul",
  dialog: service(),
  composer: service(),
  _lastDecoratedElement: null,

  _initialize: on("init", function () {
    const filter = this.get("stream.filter");
    if (filter) {
      this.set("classNames", [
        "user-stream",
        "filter-" + filter.toString().replace(",", "-"),
      ]);
    }
  }),

  loading: false,
  eyelineSelector: ".user-stream .item",
  classNames: ["user-stream"],

  _inserted: on("didInsertElement", function () {
    $(this.element).on(
      "click.details-disabled",
      "details.disabled",
      () => false
    );
    $(this.element).on("click.discourse-redirect", ".excerpt a", (e) => {
      return ClickTrack.trackClick(e, getOwner(this));
    });
    this._updateLastDecoratedElement();
    this.appEvents.trigger("decorate-non-stream-cooked-element", this.element);
  }),

  // This view is being removed. Shut down operations
  _destroyed: on("willDestroyElement", function () {
    $(this.element).off("click.details-disabled", "details.disabled");

    // Unbind link tracking
    $(this.element).off("click.discourse-redirect", ".excerpt a");
  }),

  _updateLastDecoratedElement() {
    const nodes = this.element.querySelectorAll(".user-stream-item");
    if (nodes.length === 0) {
      return;
    }
    const lastElement = nodes[nodes.length - 1];
    if (lastElement === this._lastDecoratedElement) {
      return;
    }
    this._lastDecoratedElement = lastElement;
  },

  actions: {
    removeBookmark(userAction) {
      const stream = this.stream;
      Post.updateBookmark(userAction.get("post_id"), false)
        .then(() => {
          stream.remove(userAction);
        })
        .catch(popupAjaxError);
    },

    resumeDraft(item) {
      if (this.composer.get("model.viewOpen")) {
        this.composer.close();
      }
      if (item.get("postUrl")) {
        DiscourseURL.routeTo(item.get("postUrl"));
      } else {
        Draft.get(item.draft_key)
          .then((d) => {
            const draft = d.draft || item.data;
            if (!draft) {
              return;
            }

            this.composer.open({
              draft,
              draftKey: item.draft_key,
              draftSequence: d.draft_sequence,
            });
          })
          .catch((error) => {
            popupAjaxError(error);
          });
      }
    },

    removeDraft(draft) {
      const stream = this.stream;

      this.dialog.yesNoConfirm({
        message: I18n.t("drafts.remove_confirmation"),
        didConfirm: () => {
          Draft.clear(draft.draft_key, draft.sequence)
            .then(() => {
              stream.remove(draft);
              if (draft.draft_key === NEW_TOPIC_KEY) {
                this.currentUser.set("has_topic_draft", false);
              }
            })
            .catch((error) => {
              popupAjaxError(error);
            });
        },
      });
    },

    loadMore() {
      if (this.loading) {
        return;
      }

      this.set("loading", true);
      const stream = this.stream;
      stream.findItems().then(() => {
        this.set("loading", false);

        // The next elements are not rendered on the page yet, we need to
        // wait for that before trying to decorate them.
        later(() => {
          let element = this._lastDecoratedElement?.nextElementSibling;
          while (element) {
            this.trigger("user-stream:new-item-inserted", element);
            this.appEvents.trigger(
              "decorate-non-stream-cooked-element",
              element
            );
            element = element.nextElementSibling;
          }
          this._updateLastDecoratedElement();
        });
      });
    },
  },
});
