import { getOwner } from "@ember/application";
import Component from "@ember/component";
import { action } from "@ember/object";
import { readOnly } from "@ember/object/computed";
import { service } from "@ember/service";
import CreateInvite from "discourse/components/modal/create-invite";
import { longDateNoYear } from "discourse/lib/formatter";
import Sharing from "discourse/lib/sharing";
import { bufferedProperty } from "discourse/mixins/buffered-content";
import Category from "discourse/models/category";
import { getAbsoluteURL } from "discourse-common/lib/get-url";
import discourseComputed, {
  afterRender,
} from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

const ShareTopicModal = Component.extend(bufferedProperty("invite"), {
  topic: readOnly("model.topic"),
  post: readOnly("model.post"),
  category: readOnly("model.category"),
  allowInvites: readOnly("model.allowInvites"),
  modal: service(),

  didInsertElement() {
    this._showRestrictedGroupWarning();
    this._selectUrl();
    this._super();
  },

  @afterRender
  _showRestrictedGroupWarning() {
    if (!this.category) {
      return;
    }

    Category.fetchVisibleGroups(this.category.id).then((result) => {
      if (result.groups.length > 0) {
        this.setProperties({
          flash: I18n.t("topic.share.restricted_groups", {
            count: result.groups.length,
            groupNames: result.groups.join(", "),
          }),
          flashType: "warning",
        });
      }
    });
  },

  @afterRender
  _selectUrl() {
    const input = document.querySelector("input.invite-link");
    if (input && this.site.desktopView) {
      // if the input is auto-focused on mobile, iOS requires two taps of the copy button
      input.setSelectionRange(0, this.url.length);
      input.focus();
    }
  },

  @discourseComputed("post.shareUrl", "topic.shareUrl")
  url(postUrl, topicUrl) {
    if (postUrl) {
      return getAbsoluteURL(postUrl);
    } else if (topicUrl) {
      return getAbsoluteURL(topicUrl);
    }
  },

  @discourseComputed("post.created_at", "post.wiki", "post.last_wiki_edit")
  displayDate(createdAt, wiki, lastWikiEdit) {
    const date = wiki && lastWikiEdit ? lastWikiEdit : createdAt;
    return longDateNoYear(new Date(date));
  },

  @discourseComputed(
    "topic.{isPrivateMessage,invisible,category.read_restricted}"
  )
  sources(topic) {
    const privateContext =
      this.siteSettings.login_required ||
      topic?.isPrivateMessage ||
      topic?.invisible ||
      topic?.category?.read_restricted;

    return Sharing.activeSources(this.siteSettings.share_links, privateContext);
  },

  @action
  share(source) {
    Sharing.shareSource(source, {
      title: this.topic.title,
      url: this.url,
    });
  },

  @action
  inviteUsers() {
    this.modal.show(CreateInvite, {
      model: {
        inviteToTopic: true,
        topics: [this.topic],
        topicId: this.topic.id,
        topicTitle: this.topic.title,
      },
    });
  },

  @action
  replyAsNewTopic() {
    const postStream = this.topic.postStream;
    const postId = this.post?.id || postStream.findPostIdForPostNumber(1);
    const post = postStream.findLoadedPost(postId);
    const topicController = getOwner(this).lookup("controller:topic");
    topicController.actions.replyAsNewTopic.call(topicController, post);
    this.closeModal();
  },
});

ShareTopicModal.reopenClass({
  modalClass: "share-topic-modal",
});

export default ShareTopicModal;
