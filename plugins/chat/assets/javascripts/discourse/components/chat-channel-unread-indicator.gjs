import Component from "@glimmer/component";
import { service } from "@ember/service";
import concatClass from "discourse/helpers/concat-class";
import { hasChatIndicator } from "../lib/chat-user-preferences";

export default class ChatChannelUnreadIndicator extends Component {
  @service chat;
  @service site;
  @service currentUser;

  get showUnreadIndicator() {
    return (
      this.args.channel.tracking.unreadCount > 0 ||
      // We want to do this so we don't show a blue dot if the user is inside
      // the channel and a new unread thread comes in.
      (this.chat.activeChannel?.id !== this.args.channel.id &&
        this.args.channel.unreadThreadsCountSinceLastViewed > 0)
    );
  }

  get unreadCount() {
    if (this.#hasChannelMentions()) {
      return this.args.channel.tracking.mentionCount;
    }
    return this.args.channel.tracking.unreadCount;
  }

  get isUrgent() {
    if (this.#onlyMentions()) {
      return this.#hasChannelMentions();
    }
    return (
      this.args.channel.isDirectMessageChannel || this.#hasChannelMentions()
    );
  }

  #hasChannelMentions() {
    return this.args.channel.tracking.mentionCount > 0;
  }

  #onlyMentions() {
    return hasChatIndicator(this.currentUser).ONLY_MENTIONS;
  }

  <template>
    {{#if this.showUnreadIndicator}}
      <div
        class={{concatClass
          "chat-channel-unread-indicator"
          (if this.isUrgent "-urgent")
        }}
      >
        <div class="chat-channel-unread-indicator__number">{{#if
            this.isUrgent
          }}{{this.unreadCount}}{{else}}&nbsp;{{/if}}</div>
      </div>
    {{/if}}
  </template>
}
