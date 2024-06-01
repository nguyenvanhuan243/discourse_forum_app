# frozen_string_literal: true

module Chat
  # Service responsible for updating a chat channel status.
  #
  # @example
  #  Chat::UpdateChannelStatus.call(channel_id: 2, guardian: guardian, status: "open")
  #
  class UpdateChannelStatus
    include Service::Base

    # @!method call(channel_id:, guardian:, status:)
    #   @param [Integer] channel_id
    #   @param [Guardian] guardian
    #   @param [String] status
    #   @return [Service::Base::Context]

    model :channel, :fetch_channel
    contract
    policy :check_channel_permission
    step :change_status

    # @!visibility private
    class Contract
      attribute :status
      validates :status, inclusion: { in: Chat::Channel.editable_statuses.keys }
    end

    private

    def fetch_channel(channel_id:)
      Chat::Channel.find_by(id: channel_id)
    end

    def check_channel_permission(guardian:, channel:, status:)
      guardian.can_preview_chat_channel?(channel) &&
        guardian.can_change_channel_status?(channel, status.to_sym)
    end

    def change_status(channel:, status:, guardian:)
      channel.public_send("#{status}!", guardian.user)
    end
  end
end
