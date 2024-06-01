# frozen_string_literal: true

module Chat
  # Service responsible for creating a new direct message chat channel.
  # The guardian passed in is the "acting user" when creating the channel
  # and deciding whether the actor can communicate with the users that
  # are passed in.
  #
  # @example
  #  ::Chat::CreateDirectMessageChannel.call(
  #    guardian: guardian,
  #    target_usernames: ["bob", "alice"]
  #  )
  #
  class CreateDirectMessageChannel
    include Service::Base

    # @!method call(guardian:, **params_to_create)
    #   @param [Guardian] guardian
    #   @param [Hash] params_to_create
    #   @option params_to_create [Array<String>] target_usernames
    #   @option params_to_create [Array<String>] target_groups
    #   @option params_to_create [Boolean] upsert
    #   @return [Service::Base::Context]

    contract
    model :target_users
    policy :can_create_direct_message
    policy :satisfies_dms_max_users_limit,
           class_name: Chat::DirectMessageChannel::MaxUsersExcessPolicy
    model :user_comm_screener
    policy :actor_allows_dms
    policy :targets_allow_dms_from_user,
           class_name: Chat::DirectMessageChannel::CanCommunicateAllPartiesPolicy
    model :direct_message, :fetch_or_create_direct_message
    model :channel, :fetch_or_create_channel
    step :set_optional_name
    step :update_memberships
    step :recompute_users_count

    # @!visibility private
    class Contract
      attribute :name, :string
      attribute :target_usernames, :array
      attribute :target_groups, :array
      attribute :upsert, :boolean, default: false

      validate :target_presence

      def target_presence
        target_usernames.present? || target_groups.present?
      end
    end

    private

    def can_create_direct_message(guardian:, target_users:)
      guardian.can_create_direct_message? &&
        DiscoursePluginRegistry.apply_modifier(
          :chat_can_create_direct_message_channel,
          guardian.user,
          target_users,
        )
    end

    def fetch_target_users(guardian:, contract:)
      ::Chat::UsersFromUsernamesAndGroupsQuery.call(
        usernames: [*contract.target_usernames, guardian.user.username],
        groups: contract.target_groups,
      )
    end

    def fetch_user_comm_screener(target_users:, guardian:)
      UserCommScreener.new(acting_user: guardian.user, target_user_ids: target_users.map(&:id))
    end

    def actor_allows_dms(user_comm_screener:)
      !user_comm_screener.actor_disallowing_all_pms?
    end

    def fetch_or_create_direct_message(target_users:, contract:)
      ids = target_users.map(&:id)
      is_group = ids.size > 2 || contract.name.present?

      if contract.upsert || !is_group
        ::Chat::DirectMessage.for_user_ids(ids, group: is_group) ||
          ::Chat::DirectMessage.create(user_ids: ids, group: is_group)
      else
        ::Chat::DirectMessage.create(user_ids: ids, group: is_group)
      end
    end

    def fetch_or_create_channel(direct_message:)
      ::Chat::DirectMessageChannel.find_or_create_by(chatable: direct_message)
    end

    def set_optional_name(channel:, contract:)
      channel.update!(name: contract.name) if contract.name&.length&.positive?
    end

    def update_memberships(channel:, target_users:)
      always_level = ::Chat::UserChatChannelMembership::NOTIFICATION_LEVELS[:always]

      memberships =
        target_users.map do |user|
          {
            user_id: user.id,
            chat_channel_id: channel.id,
            muted: false,
            following: false,
            desktop_notification_level: always_level,
            mobile_notification_level: always_level,
            created_at: Time.zone.now,
            updated_at: Time.zone.now,
          }
        end

      ::Chat::UserChatChannelMembership.upsert_all(
        memberships,
        unique_by: %i[user_id chat_channel_id],
      )
    end

    def recompute_users_count(channel:)
      channel.update!(
        user_count: ::Chat::ChannelMembershipsQuery.count(channel),
        user_count_stale: false,
      )
    end
  end
end
