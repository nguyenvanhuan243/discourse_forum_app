# frozen_string_literal: true

module Chat
  # List messages of a thread before and after a specific target (id, date),
  # or fetching paginated messages from last read.
  #
  # @example
  #  Chat::ListThreadMessages.call(thread_id: 2, guardian: guardian, **optional_params)
  #
  class ListChannelThreadMessages
    include Service::Base

    # @!method call(guardian:)
    #   @param [Guardian] guardian
    #   @option optional_params [Integer] thread_id
    #   @return [Service::Base::Context]

    contract

    model :thread
    policy :can_view_thread
    step :fetch_optional_membership
    step :determine_target_message_id
    policy :target_message_exists
    step :fetch_messages

    class Contract
      attribute :thread_id, :integer
      validates :thread_id, presence: true

      # If this is not present, then we just fetch messages with page_size
      # and direction.
      attribute :target_message_id, :integer # (optional)
      attribute :direction, :string # (optional)
      attribute :page_size, :integer # (optional)
      attribute :fetch_from_last_read, :boolean # (optional)
      attribute :fetch_from_last_message, :boolean # (optional)
      attribute :fetch_from_first_message, :boolean # (optional)
      attribute :target_date, :string # (optional)

      validates :direction,
                inclusion: {
                  in: Chat::MessagesQuery::VALID_DIRECTIONS,
                },
                allow_nil: true
      validates :page_size,
                numericality: {
                  less_than_or_equal_to: Chat::MessagesQuery::MAX_PAGE_SIZE,
                  only_integer: true,
                },
                allow_nil: true
    end

    private

    def fetch_optional_membership(thread:, guardian:)
      context.membership = thread.membership_for(guardian.user)
    end

    def fetch_thread(contract:)
      ::Chat::Thread.strict_loading.includes(channel: :chatable).find_by(id: contract.thread_id)
    end

    def can_view_thread(guardian:, thread:)
      guardian.user == Discourse.system_user || guardian.can_preview_chat_channel?(thread.channel)
    end

    def determine_target_message_id(contract:, membership:, guardian:, thread:)
      if contract.fetch_from_last_message
        context.target_message_id = thread.last_message_id
      elsif contract.fetch_from_first_message
        context.target_message_id = thread.original_message_id
      elsif contract.fetch_from_last_read || !contract.target_message_id
        context.target_message_id = membership&.last_read_message_id
      elsif contract.target_message_id
        context.target_message_id = contract.target_message_id
      end
    end

    def target_message_exists(contract:, guardian:)
      return true if context.target_message_id.blank?
      target_message =
        ::Chat::Message.with_deleted.find_by(
          id: context.target_message_id,
          thread_id: contract.thread_id,
        )
      return false if target_message.blank?
      return true if !target_message.trashed?
      target_message.user_id == guardian.user.id || guardian.is_staff?
    end

    def fetch_messages(thread:, guardian:, contract:)
      messages_data =
        ::Chat::MessagesQuery.call(
          channel: thread.channel,
          guardian: guardian,
          target_message_id: context.target_message_id,
          thread_id: thread.id,
          page_size: contract.page_size || Chat::MessagesQuery::MAX_PAGE_SIZE,
          direction: contract.direction,
          target_date: contract.target_date,
          include_target_message_id:
            contract.fetch_from_first_message || contract.fetch_from_last_message,
        )

      context.can_load_more_past = messages_data[:can_load_more_past]
      context.can_load_more_future = messages_data[:can_load_more_future]

      context.messages = [
        messages_data[:messages],
        messages_data[:past_messages]&.reverse,
        messages_data[:target_message],
        messages_data[:future_messages],
      ].flatten.compact
    end
  end
end
