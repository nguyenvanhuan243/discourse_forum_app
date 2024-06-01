import Controller, { inject as controller } from "@ember/controller";
import EmberObject, { action, computed } from "@ember/object";
import { equal, notEmpty } from "@ember/object/computed";
import { service } from "@ember/service";
import { htmlSafe } from "@ember/template";
import { Promise } from "rsvp";
import { ajax } from "discourse/lib/ajax";
import BulkSelectHelper from "discourse/lib/bulk-select-helper";
import Bookmark from "discourse/models/bookmark";
import { iconHTML } from "discourse-common/lib/icon-library";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default Controller.extend({
  queryParams: ["q"],
  q: null,

  router: service(),
  application: controller(),
  user: controller(),
  loading: false,
  loadingMore: false,
  permissionDenied: false,
  inSearchMode: notEmpty("q"),
  noContent: equal("model.bookmarks.length", 0),

  bulkSelectHelper: null,

  init() {
    this._super(...arguments);
    this.bulkSelectHelper = new BulkSelectHelper(this);
  },

  searchTerm: computed("q", {
    get() {
      return this.q;
    },
    set(key, value) {
      return value;
    },
  }),

  @discourseComputed()
  emptyStateBody() {
    return htmlSafe(
      I18n.t("user.no_bookmarks_body", {
        icon: iconHTML("bookmark"),
      })
    );
  },

  @discourseComputed("inSearchMode", "noContent")
  userDoesNotHaveBookmarks(inSearchMode, noContent) {
    return !inSearchMode && noContent;
  },

  @discourseComputed("inSearchMode", "noContent")
  nothingFound(inSearchMode, noContent) {
    return inSearchMode && noContent;
  },

  @action
  search() {
    this.router.transitionTo({
      queryParams: { q: this.searchTerm },
    });
  },

  @action
  reload() {
    this.send("triggerRefresh");
  },

  @action
  loadMore() {
    if (this.loadingMore) {
      return Promise.resolve();
    }

    this.set("loadingMore", true);

    return this._loadMoreBookmarks(this.q)
      .then((response) => this._processLoadResponse(this.q, response))
      .catch(() => this._bookmarksListDenied())
      .finally(() => this.set("loadingMore", false));
  },

  @action
  updateAutoAddBookmarksToBulkSelect(value) {
    this.bulkSelectHelper.autoAddBookmarksToBulkSelect = value;
  },

  _loadMoreBookmarks(searchQuery) {
    if (!this.model.loadMoreUrl) {
      return Promise.resolve();
    }

    let moreUrl = this.model.loadMoreUrl;
    if (searchQuery) {
      const delimiter = moreUrl.includes("?") ? "&" : "?";
      const q = encodeURIComponent(searchQuery);
      moreUrl += `${delimiter}q=${q}`;
    }

    return ajax({ url: moreUrl });
  },

  _bookmarksListDenied() {
    this.set("permissionDenied", true);
  },

  async _processLoadResponse(searchTerm, response) {
    if (!response || !response.user_bookmark_list) {
      this.model.loadMoreUrl = null;
      return;
    }

    response = response.user_bookmark_list;
    this.model.searchTerm = searchTerm;
    this.model.loadMoreUrl = response.more_bookmarks_url;

    if (response.bookmarks) {
      const bookmarkModels = response.bookmarks.map(this.transform);
      await Bookmark.applyTransformations(bookmarkModels);
      this.model.bookmarks.pushObjects(bookmarkModels);
      this.session.set("bookmarksModel", this.model);
    }
  },

  transform(bookmark) {
    const bookmarkModel = Bookmark.create(bookmark);
    bookmarkModel.topicStatus = EmberObject.create({
      closed: bookmark.closed,
      archived: bookmark.archived,
      is_warning: bookmark.is_warning,
      pinned: false,
      unpinned: false,
      invisible: bookmark.invisible,
    });
    return bookmarkModel;
  },
});
