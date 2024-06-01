import { htmlSafe } from "@ember/template";
import DButton from "discourse/components/d-button";
import replaceEmoji from "discourse/helpers/replace-emoji";
import dIcon from "discourse-common/helpers/d-icon";
import ChatUserAvatar from "./chat-user-avatar";

const ChatComposerMessageDetails = <template>
  <div
    class="chat-composer-message-details"
    data-id={{@message.id}}
    data-action={{if @message.editing "edit" "reply"}}
  >
    <div class="chat-reply">
      {{dIcon (if @message.editing "pencil-alt" "reply")}}
      <ChatUserAvatar @user={{@message.user}} />
      <span class="chat-reply__username">{{@message.user.username}}</span>
      <span class="chat-reply__excerpt">
        {{replaceEmoji (htmlSafe @message.excerpt)}}
      </span>
    </div>

    <DButton
      @action={{@cancelAction}}
      @icon="times-circle"
      @title="cancel"
      class="btn-flat cancel-message-action"
    />
  </div>
</template>;

export default ChatComposerMessageDetails;
