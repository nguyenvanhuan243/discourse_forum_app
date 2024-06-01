# frozen_string_literal: true

module Chat
  # Gets a list of threads for a user.
  #
  # Only threads that the user is a member of with a notification level
  # of normal or tracking will be returned.
  #
  # @example
  #  Chat::LookupUserThreads.call(guardian: guardian, limit: 5, offset: 2)
  #
  class LookupUserThreads
    include Service::Base

    THREADS_LIMIT = 10

    # @!method call(guardian:, limit: nil, offset: nil)
    #   @param [Guardian] guardian
    #   @param [Integer] limit
    #   @param [Integer] offset
    #   @return [Service::Base::Context]

    contract
    step :set_limit
    step :set_offset
    model :threads
    step :fetch_tracking
    step :fetch_memberships
    step :fetch_participants
    step :build_load_more_url

    # @!visibility private
    class Contract
      attribute :limit, :integer
      attribute :offset, :integer
    end

    private

    def set_limit(contract:)
      context.limit = (contract.limit || THREADS_LIMIT).to_i.clamp(1, THREADS_LIMIT)
    end

    def set_offset(contract:)
      context.offset = [contract.offset || 0, 0].max
    end

    def fetch_threads(guardian:)
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
          "INNER JOIN user_chat_thread_memberships ON chat_threads.id = user_chat_thread_memberships.thread_id",
        )
        .joins(
          "LEFT JOIN chat_messages AS last_message ON chat_threads.last_message_id = last_message.id",
        )
        .joins(
          "INNER JOIN chat_messages AS original_message ON chat_threads.original_message_id = original_message.id",
        )
        .where(
          channel_id:
            ::Chat::Channel
              .joins(:user_chat_channel_memberships)
              .where(user_chat_channel_memberships: { user_id: guardian.user.id, following: true })
              .where.not("user_chat_channel_memberships.muted")
              .where(
                {
                  chatable_type: "Category",
                  threading_enabled: true,
                  status: ::Chat::Channel.statuses[:open],
                },
              )
              .select(:id),
        )
        .where("original_message.chat_channel_id = chat_threads.channel_id")
        .where("original_message.deleted_at IS NULL")
        .where("last_message.chat_channel_id = chat_threads.channel_id")
        .where("last_message.deleted_at IS NULL")
        .where("chat_threads.replies_count > 0")
        .where("user_chat_thread_memberships.user_id = ?", guardian.user.id)
        .where(
          "user_chat_thread_memberships.notification_level IN (?)",
          [
            ::Chat::UserChatThreadMembership.notification_levels[:normal],
            ::Chat::UserChatThreadMembership.notification_levels[:tracking],
          ],
        )
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
      load_more_params = { limit: context.limit, offset: context.offset + context.limit }.to_query

      context.load_more_url =
        ::URI::HTTP.build(path: "/chat/api/me/threads", query: load_more_params).request_uri
    end
  end
end
