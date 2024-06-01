import Controller, { inject as controller } from "@ember/controller";
import { action } from "@ember/object";
import { gt, or } from "@ember/object/computed";
import { service } from "@ember/service";
import { isEmpty } from "@ember/utils";
import { Promise } from "rsvp";
import TopicBulkActions from "discourse/components/modal/topic-bulk-actions";
import { ajax } from "discourse/lib/ajax";
import { search as searchCategoryTag } from "discourse/lib/category-tag-search";
import { setTransient } from "discourse/lib/page-tracker";
import {
  getSearchKey,
  isValidSearchTerm,
  logSearchLinkClick,
  reciprocallyRankedList,
  searchContextDescription,
  translateResults,
  updateRecentSearches,
} from "discourse/lib/search";
import userSearch from "discourse/lib/user-search";
import { escapeExpression } from "discourse/lib/utilities";
import { scrollTop } from "discourse/mixins/scroll-top";
import Category from "discourse/models/category";
import Composer from "discourse/models/composer";
import discourseComputed, {
  bind,
  observes,
} from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

const SortOrders = [
  { name: I18n.t("search.relevance"), id: 0 },
  { name: I18n.t("search.latest_post"), id: 1, term: "order:latest" },
  { name: I18n.t("search.most_liked"), id: 2, term: "order:likes" },
  { name: I18n.t("search.most_viewed"), id: 3, term: "order:views" },
  { name: I18n.t("search.latest_topic"), id: 4, term: "order:latest_topic" },
];

export const SEARCH_TYPE_DEFAULT = "topics_posts";
export const SEARCH_TYPE_CATS_TAGS = "categories_tags";
export const SEARCH_TYPE_USERS = "users";

const PAGE_LIMIT = 10;

const customSearchTypes = [];

export function registerFullPageSearchType(
  translationKey,
  searchTypeId,
  searchFunc
) {
  customSearchTypes.push({ translationKey, searchTypeId, searchFunc });
}

export default Controller.extend({
  application: controller(),
  composer: service(),
  modal: service(),
  appEvents: service(),
  siteSettings: service(),
  searchPreferencesManager: service(),

  bulkSelectEnabled: null,
  loading: false,
  queryParams: [
    "q",
    "expanded",
    "context_id",
    "context",
    "skip_context",
    "search_type",
  ],
  q: undefined,
  context_id: null,
  search_type: SEARCH_TYPE_DEFAULT,
  context: null,
  searching: false,
  sortOrder: 0,
  sortOrders: SortOrders,
  invalidSearch: false,
  page: 1,
  resultCount: null,
  searchTypes: null,
  additionalSearchResults: [],
  selected: [],
  error: null,

  init() {
    this._super(...arguments);

    this.set(
      "sortOrder",
      this.searchPreferencesManager.sortOrder ||
        this.siteSettings.search_default_sort_order
    );

    const searchTypes = [
      { name: I18n.t("search.type.default"), id: SEARCH_TYPE_DEFAULT },
      {
        name: this.siteSettings.tagging_enabled
          ? I18n.t("search.type.categories_and_tags")
          : I18n.t("search.type.categories"),
        id: SEARCH_TYPE_CATS_TAGS,
      },
      { name: I18n.t("search.type.users"), id: SEARCH_TYPE_USERS },
    ];

    customSearchTypes.forEach((type) => {
      searchTypes.push({
        name: I18n.t(type.translationKey),
        id: type.searchTypeId,
      });
    });

    this.set("searchTypes", searchTypes);
  },

  @discourseComputed("resultCount")
  hasResults(resultCount) {
    return (resultCount || 0) > 0;
  },

  @discourseComputed("expanded")
  expandFilters(expanded) {
    return expanded === "true";
  },

  @discourseComputed("q")
  hasAutofocus(q) {
    return isEmpty(q);
  },

  @discourseComputed("q")
  highlightQuery(q) {
    if (!q) {
      return;
    }
    return q
      .split(/\s+/)
      .filter((t) => t !== "l")
      .join(" ");
  },

  @discourseComputed("skip_context", "context")
  searchContextEnabled: {
    get(skip, context) {
      return (!skip && context) || skip === "false";
    },
    set(val) {
      this.set("skip_context", !val);
    },
  },

  @discourseComputed("context", "context_id")
  searchContextDescription(context, id) {
    let name = id;
    if (context === "category") {
      let category = Category.findById(id);
      if (!category) {
        return;
      }

      name = category.get("name");
    }
    return searchContextDescription(context, name);
  },

  @discourseComputed("q")
  searchActive(q) {
    return isValidSearchTerm(q, this.siteSettings);
  },

  @discourseComputed("q")
  noSortQ(q) {
    q = this.cleanTerm(q);
    return escapeExpression(q);
  },

  @discourseComputed("canCreateTopic", "siteSettings.login_required")
  showSuggestion(canCreateTopic, loginRequired) {
    return canCreateTopic || !loginRequired;
  },

  _searchOnSortChange: true,

  setSearchTerm(term) {
    this._searchOnSortChange = false;
    term = this.cleanTerm(term);
    this._searchOnSortChange = true;
    this.set("searchTerm", term);
  },

  cleanTerm(term) {
    if (term) {
      SortOrders.forEach((order) => {
        if (order.term) {
          let matches = term.match(new RegExp(`${order.term}\\b`));
          if (matches) {
            this.set("sortOrder", order.id);
            term = term.replace(new RegExp(`${order.term}\\b`, "g"), "");
            term = term.trim();
          }
        }
      });
    }
    return term;
  },

  @observes("sortOrder")
  triggerSearch() {
    if (this._searchOnSortChange) {
      this.set("page", 1);
      this._search();
    }
  },

  @observes("search_type")
  triggerSearchOnTypeChange() {
    if (this.searchActive) {
      this.set("page", 1);
      this._search();
    }
  },

  @observes("model")
  modelChanged() {
    if (this.searchTerm !== this.q) {
      this.setSearchTerm(this.q);
    }
  },

  @discourseComputed("q")
  showLikeCount(q) {
    return q?.includes("order:likes");
  },

  @observes("q")
  qChanged() {
    const model = this.model;
    if (model && this.get("model.q") !== this.q) {
      this.setSearchTerm(this.q);
      this.send("search");
    }
  },

  @discourseComputed("q")
  isPrivateMessage(q) {
    return (
      q &&
      this.currentUser &&
      (q.includes("in:messages") ||
        q.includes("in:personal") ||
        q.includes(
          `personal_messages:${this.currentUser.get("username_lower")}`
        ))
    );
  },

  @discourseComputed("resultCount", "noSortQ")
  resultCountLabel(count, term) {
    const plus = count % 50 === 0 ? "+" : "";
    return I18n.t("search.result_count", { count, plus, term });
  },

  @observes("model.{posts,categories,tags,users}.length", "searchResultPosts")
  resultCountChanged() {
    if (!this.model.posts) {
      return 0;
    }

    this.set(
      "resultCount",
      this.searchResultPosts.length +
        this.model.categories.length +
        this.model.tags.length +
        this.model.users.length
    );
  },

  @discourseComputed("hasResults")
  canBulkSelect(hasResults) {
    return this.currentUser && this.currentUser.staff && hasResults;
  },

  hasSelection: gt("selected.length", 0),

  @discourseComputed("selected.length", "searchResultPosts.length")
  hasUnselectedResults(selectionCount, postsCount) {
    return selectionCount < postsCount;
  },

  @discourseComputed("model.grouped_search_result.can_create_topic")
  canCreateTopic(userCanCreateTopic) {
    return this.currentUser && userCanCreateTopic;
  },

  @discourseComputed("page")
  isLastPage(page) {
    return page === PAGE_LIMIT;
  },

  @discourseComputed("search_type")
  usingDefaultSearchType(searchType) {
    return searchType === SEARCH_TYPE_DEFAULT;
  },

  @discourseComputed("search_type")
  customSearchType(searchType) {
    return customSearchTypes.find(
      (type) => searchType === type["searchTypeId"]
    );
  },

  @discourseComputed("bulkSelectEnabled")
  searchInfoClassNames(bulkSelectEnabled) {
    return bulkSelectEnabled
      ? "search-info bulk-select-visible"
      : "search-info";
  },

  @discourseComputed("model.posts", "additionalSearchResults")
  searchResultPosts(posts, additionalSearchResults) {
    if (additionalSearchResults?.list?.length > 0) {
      return reciprocallyRankedList(
        [posts, additionalSearchResults.list],
        ["topic_id", additionalSearchResults.identifier]
      );
    } else {
      return posts;
    }
  },

  searchButtonDisabled: or("searching", "loading"),

  @bind
  _search() {
    if (this.searching) {
      return;
    }

    this.set("invalidSearch", false);
    const searchTerm = this.searchTerm;
    if (!isValidSearchTerm(searchTerm, this.siteSettings)) {
      this.set("invalidSearch", true);
      return;
    }

    let args = { q: searchTerm, page: this.page };

    if (args.page === 1) {
      this.set("bulkSelectEnabled", false);

      this.selected.clear();
      this.set("searching", true);
      scrollTop();
    } else {
      this.set("loading", true);
    }

    const sortOrder = this.sortOrder;
    if (sortOrder && SortOrders[sortOrder].term) {
      args.q += " " + SortOrders[sortOrder].term;
    }

    this.set("q", args.q);

    const skip = this.skip_context;
    if ((!skip && this.context) || skip === "false") {
      args.search_context = {
        type: this.context,
        id: this.context_id,
      };
    }

    const searchKey = getSearchKey(args);

    if (this.customSearchType) {
      const customSearch = this.customSearchType["searchFunc"];
      customSearch(this, args, searchKey);
      return;
    }

    switch (this.search_type) {
      case SEARCH_TYPE_CATS_TAGS:
        const categoryTagSearch = searchCategoryTag(
          searchTerm,
          this.siteSettings
        );
        Promise.resolve(categoryTagSearch)
          .then(async (results) => {
            const categories = results.filter((c) => Boolean(c.model));
            const tags = results.filter((c) => !c.model);
            const model = (await translateResults({ categories, tags })) || {};
            this.set("model", model);
          })
          .finally(() => {
            this.setProperties({
              searching: false,
              loading: false,
            });
          });
        break;
      case SEARCH_TYPE_USERS:
        userSearch({ term: searchTerm, limit: 20 })
          .then(async (results) => {
            const model = (await translateResults({ users: results })) || {};
            this.set("model", model);
          })
          .finally(() => {
            this.setProperties({
              searching: false,
              loading: false,
            });
          });
        break;
      default:
        if (this.currentUser) {
          updateRecentSearches(this.currentUser, searchTerm);
        }
        ajax("/search", { data: args })
          .then(async (results) => {
            const model = (await translateResults(results)) || {};

            if (results.grouped_search_result) {
              this.set("q", results.grouped_search_result.term);
            }

            if (args.page > 1) {
              if (model) {
                this.model.posts.pushObjects(model.posts);
                this.model.topics.pushObjects(model.topics);
                this.model.set(
                  "grouped_search_result",
                  results.grouped_search_result
                );
              }
            } else {
              setTransient("lastSearch", { searchKey, model }, 5);
              model.grouped_search_result = results.grouped_search_result;
              this.set("model", model);
            }
            this.set("error", null);
          })
          .catch((e) => {
            this.set("error", e.jqXHR.responseJSON?.message);
          })
          .finally(() => {
            this.setProperties({
              searching: false,
              loading: false,
            });
          });
        break;
    }
  },

  _afterTransition() {
    if (Object.keys(this.model).length === 0) {
      this.reset();
    }
  },

  reset() {
    this.setProperties({
      searching: false,
      page: 1,
      resultCount: null,
      selected: [],
    });
  },

  @action
  createTopic(searchTerm, event) {
    event?.preventDefault();
    let topicCategory;
    if (searchTerm.includes("category:")) {
      const match = searchTerm.match(/category:(\S*)/);
      if (match && match[1]) {
        topicCategory = match[1];
      }
    }
    this.composer.open({
      action: Composer.CREATE_TOPIC,
      draftKey: Composer.NEW_TOPIC_KEY,
      topicCategory,
    });
  },

  @action
  addSearchResults(list, identifier) {
    this.set("additionalSearchResults", {
      list,
      identifier,
    });
  },

  @action
  setSortOrder(value) {
    this.set("sortOrder", value);
    this.searchPreferencesManager.sortOrder = value;
  },

  actions: {
    selectAll() {
      this.selected.addObjects(this.get("searchResultPosts").mapBy("topic"));

      // Doing this the proper way is a HUGE pain,
      // we can hack this to work by observing each on the array
      // in the component, however, when we select ANYTHING, we would force
      // 50 traversals of the list
      // This hack is cheap and easy
      document
        .querySelectorAll(".fps-result input[type=checkbox]")
        .forEach((checkbox) => {
          checkbox.checked = true;
        });
    },

    clearAll() {
      this.selected.clear();

      document
        .querySelectorAll(".fps-result input[type=checkbox]")
        .forEach((checkbox) => {
          checkbox.checked = false;
        });
    },

    toggleBulkSelect() {
      this.toggleProperty("bulkSelectEnabled");
      this.selected.clear();
    },

    showBulkActions() {
      this.modal.show(TopicBulkActions, {
        model: {
          topics: this.selected,
          refreshClosure: this._search,
        },
      });
    },

    search(options = {}) {
      if (this.searching) {
        return;
      }

      if (options.collapseFilters) {
        document
          .querySelector("details.advanced-filters")
          ?.removeAttribute("open");
      }
      this.set("page", 1);

      this.appEvents.trigger("full-page-search:trigger-search");

      this._search();
    },

    loadMore() {
      let page = this.page;
      if (
        this.get("model.grouped_search_result.more_full_page_results") &&
        !this.loading &&
        page < PAGE_LIMIT
      ) {
        this.incrementProperty("page");
        this._search();
      }
    },

    logClick(topicId) {
      if (this.get("model.grouped_search_result.search_log_id") && topicId) {
        logSearchLinkClick({
          searchLogId: this.get("model.grouped_search_result.search_log_id"),
          searchResultId: topicId,
          searchResultType: "topic",
        });
      }
    },
  },
});
