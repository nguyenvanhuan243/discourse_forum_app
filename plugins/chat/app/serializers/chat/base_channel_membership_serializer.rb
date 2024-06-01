# frozen_string_literal: true

module Chat
  class BaseChannelMembershipSerializer < ApplicationSerializer
    attributes :following,
               :muted,
               :desktop_notification_level,
               :mobile_notification_level,
               :chat_channel_id,
               :last_read_message_id,
               :last_viewed_at
  end
end
