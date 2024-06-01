# frozen_string_literal: true

module Chat
  # Service responsible for trashing multiple chat messages
  # for a channel and ensuring that their client and read state
  # is updated.
  #
  # @example
  #  Chat::TrashMessages.call(message_ids: [2, 3], channel_id: 1, guardian: guardian)
  #
  class TrashMessages
    include Service::Base

    # @!method call(message_ids:, channel_id:, guardian:)
    #   @param [Array<Integer>] message_ids
    #   @param [Integer] channel_id
    #   @param [Guardian] guardian
    #   @return [Service::Base::Context]

    contract
    model :messages
    policy :can_delete_all_chat_messages
    transaction do
      step :trash_messages
      step :destroy_notifications
      step :update_last_message_ids
      step :update_tracking_states
      step :update_thread_reply_cache
    end
    step :publish_events

    # @!visibility private
    class Contract
      attribute :channel_id, :integer
      attribute :message_ids, :array
      validates :channel_id, presence: true
      validates :message_ids, length: { minimum: 1, maximum: 50 }
    end

    private

    def fetch_messages(contract:)
      Chat::Message.includes(chat_channel: :chatable).where(
        id: contract.message_ids,
        chat_channel_id: contract.channel_id,
      )
    end

    def can_delete_all_chat_messages(guardian:, messages:)
      messages.all? { |message| guardian.can_delete_chat?(message, message.chat_channel.chatable) }
    end

    def trash_messages(guardian:, messages:)
      messages.each { |message| message.trash!(guardian.user) }
    end

    def destroy_notifications(messages:)
      Notification.where(
        id:
          Chat::Mention
            .where(chat_message_id: messages.map(&:id))
            .joins(:notifications)
            .select("notifications.id"),
      ).destroy_all
    end

    def update_last_message_ids(messages:)
      messages.each do |message|
        message.thread&.update_last_message_id!
        message.chat_channel.update_last_message_id!
      end
    end

    def update_tracking_states(messages:)
      messages.each do |message|
        ::Chat::Action::ResetUserLastReadChannelMessage.call(
          [message.id],
          [message.chat_channel_id],
        )
        if message.thread_id.present?
          ::Chat::Action::ResetUserLastReadThreadMessage.call([message.id], [message.thread_id])
        end
      end
    end

    def update_thread_reply_cache(messages:)
      messages.each { |message| message.thread&.decrement_replies_count_cache }
    end

    def publish_events(contract:, guardian:, messages:)
      messages.each do |message|
        DiscourseEvent.trigger(:chat_message_trashed, message, message.chat_channel, guardian.user)
      end
      Chat::Publisher.publish_bulk_delete!(messages.first.chat_channel, contract.message_ids)
    end
  end
end
