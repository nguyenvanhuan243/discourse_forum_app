# frozen_string_literal: true

RSpec.describe Jobs::Chat::NotifyWatching do
  fab!(:user1) { Fabricate(:user) }
  fab!(:user2) { Fabricate(:user) }
  fab!(:user3) { Fabricate(:user) }
  fab!(:group)
  let(:except_user_ids) { [] }

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
  end

  def run_job
    described_class.new.execute(chat_message_id: message.id, except_user_ids: except_user_ids)
  end

  def notification_messages_for(user)
    MessageBus
      .track_publish { run_job }
      .filter { |m| m.channel == "/chat/notification-alert/#{user.id}" }
  end

  context "for a category channel" do
    fab!(:channel) { Fabricate(:category_channel) }
    fab!(:membership1) do
      Fabricate(:user_chat_channel_membership, user: user1, chat_channel: channel)
    end
    fab!(:membership2) do
      Fabricate(:user_chat_channel_membership, user: user2, chat_channel: channel)
    end
    fab!(:membership3) do
      Fabricate(:user_chat_channel_membership, user: user3, chat_channel: channel)
    end
    fab!(:message) do
      Fabricate(:chat_message, chat_channel: channel, user: user1, message: "this is a new message")
    end

    before do
      membership2.update!(
        desktop_notification_level: Chat::UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
      )
    end

    it "sends a desktop notification" do
      messages = notification_messages_for(user2)

      expect(messages.first.data).to include(
        {
          username: user1.username,
          notification_type: Notification.types[:chat_message],
          post_url: message.url,
          translated_title:
            I18n.t(
              "discourse_push_notifications.popup.new_chat_message",
              { username: user1.username, channel: channel.title(user2) },
            ),
          tag: Chat::Notifier.push_notification_tag(:message, channel.id),
          excerpt: message.message,
        },
      )
    end

    context "with chat_notification_translation_args plugin_modifier" do
      let(:modifier_block) do
        Proc.new do |args|
          args[:username] = "Hijacked"
          args
        end
      end
      it "Allows for changes to the translation args" do
        plugin_instance = Plugin::Instance.new
        plugin_instance.register_modifier(:chat_notification_translation_args, &modifier_block)

        messages = notification_messages_for(user2)

        expect(messages.first.data[:translated_title]).to start_with("Hijacked")
      ensure
        DiscoursePluginRegistry.unregister_modifier(
          plugin_instance,
          :chat_notification_translation_args,
          &modifier_block
        )
      end
    end

    context "with push_notification_filter registered to block push notifications" do
      after { DiscoursePluginRegistry.reset_register!(:push_notification_filters) }

      it "doesn't send notification alert via MessageBus" do
        Plugin::Instance.new.register_push_notification_filter { |user, payload| false }

        expect(notification_messages_for(user2)).to be_empty
      end
    end

    context "when the channel is muted via membership preferences" do
      before { membership2.update!(muted: true) }

      it "does not send a desktop or mobile notification" do
        PostAlerter.expects(:push_notification).never
        messages = notification_messages_for(user2)
        expect(messages).to be_empty
      end
    end

    context "when mobile_notification_level is always and desktop_notification_level is none" do
      before do
        membership2.update!(
          desktop_notification_level: Chat::UserChatChannelMembership::NOTIFICATION_LEVELS[:never],
          mobile_notification_level: Chat::UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
        )
      end

      it "sends a mobile notification" do
        PostAlerter.expects(:push_notification).with(
          user2,
          has_entries(
            {
              username: user1.username,
              notification_type: Notification.types[:chat_message],
              post_url: message.url,
              translated_title:
                I18n.t(
                  "discourse_push_notifications.popup.new_chat_message",
                  { username: user1.username, channel: channel.title(user2) },
                ),
              tag: Chat::Notifier.push_notification_tag(:message, channel.id),
              excerpt: message.message,
            },
          ),
        )
        messages = notification_messages_for(user2)
        expect(messages.length).to be_zero
      end

      context "when the channel is muted via membership preferences" do
        before { membership2.update!(muted: true) }

        it "does not send a desktop or mobile notification" do
          PostAlerter.expects(:push_notification).never
          messages = notification_messages_for(user2)
          expect(messages).to be_empty
        end
      end
    end

    context "when the target user cannot chat" do
      before { SiteSetting.chat_allowed_groups = group.id }

      it "does not send a desktop notification" do
        expect(notification_messages_for(user2).count).to be_zero
      end
    end

    context "when the target user cannot see the chat channel" do
      before { channel.update!(chatable: Fabricate(:private_category, group: group)) }

      it "does not send a desktop notification" do
        expect(notification_messages_for(user2).count).to be_zero
      end
    end

    context "when the target user has seen the message already" do
      before { membership2.update!(last_read_message_id: message.id) }

      it "does not send a desktop notification" do
        expect(notification_messages_for(user2).count).to be_zero
      end
    end

    context "when the target user is suspended" do
      before { user2.update!(suspended_till: 1.year.from_now) }

      it "does not send a desktop notification" do
        expect(notification_messages_for(user2).count).to be_zero
      end
    end

    context "when the target user is inside the except_user_ids array" do
      let(:except_user_ids) { [user2.id] }

      it "does not send a desktop notification" do
        expect(notification_messages_for(user2).count).to be_zero
      end
    end
  end

  context "for a direct message channel" do
    fab!(:channel) do
      Fabricate(:direct_message_channel, users: [user1, user2, user3], with_membership: false)
    end
    fab!(:membership1) do
      Fabricate(:user_chat_channel_membership, user: user1, chat_channel: channel)
    end
    fab!(:membership2) do
      Fabricate(:user_chat_channel_membership, user: user2, chat_channel: channel)
    end
    fab!(:membership3) do
      Fabricate(:user_chat_channel_membership, user: user3, chat_channel: channel)
    end
    fab!(:message) { Fabricate(:chat_message, chat_channel: channel, user: user1) }

    before do
      membership2.update!(
        desktop_notification_level: Chat::UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
      )
    end

    it "sends a desktop notification" do
      messages = notification_messages_for(user2)

      expect(messages.first.data).to include(
        {
          username: user1.username,
          notification_type: Notification.types[:chat_message],
          post_url: message.url,
          translated_title:
            I18n.t(
              "discourse_push_notifications.popup.new_direct_chat_message",
              { username: user1.username, channel: channel.title(user2) },
            ),
          tag: Chat::Notifier.push_notification_tag(:message, channel.id),
          excerpt: message.push_notification_excerpt,
        },
      )
    end

    context "when the channel is muted via membership preferences" do
      before { membership2.update!(muted: true) }

      it "does not send a desktop or mobile notification" do
        PostAlerter.expects(:push_notification).never
        messages = notification_messages_for(user2)
        expect(messages).to be_empty
      end
    end

    context "when mobile_notification_level is always and desktop_notification_level is none" do
      before do
        membership2.update!(
          desktop_notification_level: Chat::UserChatChannelMembership::NOTIFICATION_LEVELS[:never],
          mobile_notification_level: Chat::UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
        )
      end

      it "sends a mobile notification" do
        PostAlerter.expects(:push_notification).with(
          user2,
          has_entries(
            {
              username: user1.username,
              notification_type: Notification.types[:chat_message],
              post_url: message.url,
              translated_title:
                I18n.t(
                  "discourse_push_notifications.popup.new_direct_chat_message",
                  { username: user1.username, channel: channel.title(user2) },
                ),
              tag: Chat::Notifier.push_notification_tag(:message, channel.id),
              excerpt: message.push_notification_excerpt,
            },
          ),
        )
        messages = notification_messages_for(user2)
        expect(messages.length).to be_zero
      end

      context "when the channel is muted via membership preferences" do
        before { membership2.update!(muted: true) }

        it "does not send a desktop or mobile notification" do
          PostAlerter.expects(:push_notification).never
          messages = notification_messages_for(user2)
          expect(messages).to be_empty
        end
      end
    end

    context "when the target user cannot chat" do
      before { SiteSetting.chat_allowed_groups = group.id }

      it "does not send a desktop notification" do
        expect(notification_messages_for(user2).count).to be_zero
      end
    end

    context "when the target user cannot see the chat channel" do
      before { membership2.destroy! }

      it "does not send a desktop notification" do
        expect(notification_messages_for(user2).count).to be_zero
      end
    end

    context "when the target user has seen the message already" do
      before { membership2.update!(last_read_message_id: message.id) }

      it "does not send a desktop notification" do
        expect(notification_messages_for(user2).count).to be_zero
      end
    end

    context "when the target user is suspended" do
      before { user2.update!(suspended_till: 1.year.from_now) }

      it "does not send a desktop notification" do
        expect(notification_messages_for(user2).count).to be_zero
      end
    end

    context "when the target user is inside the except_user_ids array" do
      let(:except_user_ids) { [user2.id] }

      it "does not send a desktop notification" do
        expect(notification_messages_for(user2).count).to be_zero
      end
    end

    context "when the target user is preventing communication from the message creator" do
      before { UserCommScreener.any_instance.expects(:allowing_actor_communication).returns([]) }

      it "does not send a desktop notification" do
        expect(notification_messages_for(user2).count).to be_zero
      end
    end
  end
end
