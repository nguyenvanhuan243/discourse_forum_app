# frozen_string_literal: true

module Chat
  # Gets a list of threads for a channel to be shown in an index.
  # In future pagination and filtering will be added -- for now
  # we just want to return N threads ordered by the latest
  # message that a user has sent in a thread.
  #
  # Only threads that the user is a member of with a notification level
  # of normal or tracking will be returned.
  #
  # @example
  #  Chat::LookupChannelThreads.call(channel_id: 2, guardian: guardian, limit: 5, offset: 2)
  #
  class LookupChannelThreads
    include Service::Base

    THREADS_LIMIT = 10

    # @!method call(channel_id:, guardian:, limit: nil, offset: nil)
    #   @param [Integer] channel_id
    #   @param [Guardian] guardian
    #   @param [Integer] limit
    #   @param [Integer] offset
    #   @return [Service::Base::Context]

    contract
    step :set_limit
    step :set_offset
    model :channel
    policy :threading_enabled_for_channel
    policy :can_view_channel
    model :threads
    step :fetch_tracking
    step :fetch_memberships
    step :fetch_participants
    step :build_load_more_url

    # @!visibility private
    class Contract
      attribute :channel_id, :integer
      validates :channel_id, presence: true

      attribute :limit, :integer
      validates :limit,
                numericality: {
                  less_than_or_equal_to: THREADS_LIMIT,
                  only_integer: true,
                },
                allow_nil: true

      attribute :offset, :integer
    end

    private

    def set_limit(contract:)
      context.limit = (contract.limit || THREADS_LIMIT).to_i.clamp(1, THREADS_LIMIT)
    end

    def set_offset(contract:)
      context.offset = [contract.offset || 0, 0].max
    end

    def fetch_channel(contract:)
      ::Chat::Channel.strict_loading.includes(:chatable).find_by(id: contract.channel_id)
    end

    def threading_enabled_for_channel(channel:)
      channel.threading_enabled
    end

    def can_view_channel(guardian:, channel:)
      guardian.can_preview_chat_channel?(channel)
    end

    def fetch_threads(guardian:, channel:)
      ::Chat::Thread
        .includes(
          :channel,
          :user_chat_thread_memberships,
          original_message_user: :user_status,
          last_message: [
            :uploads,
            :chat_webhook_event,
            :chat_channel,
            user_mentions: {
              user: :user_status,
            },
            user: :user_status,
          ],
          original_message: [
            :uploads,
            :chat_webhook_event,
            :chat_channel,
            user_mentions: {
              user: :user_status,
            },
            user: :user_status,
          ],
        )
        .joins(
          "LEFT JOIN user_chat_thread_memberships ON chat_threads.id = user_chat_thread_memberships.thread_id AND user_chat_thread_memberships.user_id = #{guardian.user.id} AND user_chat_thread_memberships.notification_level NOT IN (#{::Chat::UserChatThreadMembership.notification_levels[:muted]})",
        )
        .joins(
          "LEFT JOIN chat_messages AS last_message ON chat_threads.last_message_id = last_message.id",
        )
        .joins(
          "INNER JOIN chat_messages AS original_message ON chat_threads.original_message_id = original_message.id",
        )
        .where(channel_id: channel.id)
        .where("original_message.chat_channel_id = chat_threads.channel_id")
        .where("original_message.deleted_at IS NULL")
        .where("last_message.chat_channel_id = chat_threads.channel_id")
        .where("last_message.deleted_at IS NULL")
        .where("chat_threads.replies_count > 0")
        .order(
          "CASE WHEN user_chat_thread_memberships.last_read_message_id IS NULL OR user_chat_thread_memberships.last_read_message_id < chat_threads.last_message_id THEN true ELSE false END DESC, last_message.created_at DESC",
        )
        .limit(context.limit)
        .offset(context.offset)
    end

    def fetch_tracking(guardian:, threads:)
      context.tracking =
        ::Chat::TrackingStateReportQuery.call(
          guardian: guardian,
          thread_ids: threads.map(&:id),
          include_threads: true,
        ).thread_tracking
    end

    def fetch_memberships(guardian:, threads:)
      context.memberships =
        ::Chat::UserChatThreadMembership.where(
          thread_id: threads.map(&:id),
          user_id: guardian.user.id,
        )
    end

    def fetch_participants(threads:)
      context.participants = ::Chat::ThreadParticipantQuery.call(thread_ids: threads.map(&:id))
    end

    def build_load_more_url(contract:)
      load_more_params = { offset: context.offset + context.limit }.to_query
      context.load_more_url =
        ::URI::HTTP.build(
          path: "/chat/api/channels/#{contract.channel_id}/threads",
          query: load_more_params,
        ).request_uri
    end
  end
end
