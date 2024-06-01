# frozen_string_literal: true

module Chat
  # Service responsible for updating the last read message id of a membership.
  #
  # @example
  #  Chat::UpdateUserChannelLastRead.call(channel_id: 2, message_id: 3, guardian: guardian)
  #
  class UpdateUserChannelLastRead
    include ::Service::Base

    # @!method call(channel_id:, message_id:, guardian:)
    #   @param [Integer] channel_id
    #   @param [Integer] message_id
    #   @param [Guardian] guardian
    #   @return [Service::Base::Context]

    contract
    model :channel
    model :membership
    policy :invalid_access
    model :message
    policy :ensure_message_id_recency
    transaction do
      step :update_membership_state
      step :mark_associated_mentions_as_read
    end
    step :publish_new_last_read_to_clients

    # @!visibility private
    class Contract
      attribute :message_id, :integer
      attribute :channel_id, :integer

      validates :message_id, :channel_id, presence: true
    end

    private

    def fetch_channel(contract:)
      ::Chat::Channel.find_by(id: contract.channel_id)
    end

    def fetch_membership(guardian:, channel:)
      ::Chat::ChannelMembershipManager.new(channel).find_for_user(guardian.user, following: true)
    end

    def invalid_access(guardian:, membership:)
      guardian.can_join_chat_channel?(membership.chat_channel)
    end

    def fetch_message(channel:, contract:)
      ::Chat::Message.with_deleted.find_by(chat_channel_id: channel.id, id: contract.message_id)
    end

    def ensure_message_id_recency(message:, membership:)
      !membership.last_read_message_id || message.id >= membership.last_read_message_id
    end

    def update_membership_state(message:, membership:)
      membership.update!(last_read_message_id: message.id, last_viewed_at: Time.zone.now)
    end

    def mark_associated_mentions_as_read(membership:, message:)
      ::Chat::Action::MarkMentionsRead.call(
        membership.user,
        channel_ids: [membership.chat_channel.id],
        message_id: message.id,
      )
    end

    def publish_new_last_read_to_clients(guardian:, channel:, message:)
      ::Chat::Publisher.publish_user_tracking_state!(guardian.user, channel, message)
    end
  end
end
