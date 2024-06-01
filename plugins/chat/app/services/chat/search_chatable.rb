# frozen_string_literal: true

module Chat
  # Returns a list of chatables (users, groups ,category channels, direct message channels) that can be chatted with.
  #
  # @example
  #  Chat::SearchChatable.call(term: "@bob", guardian: guardian)
  #
  class SearchChatable
    include Service::Base

    # @!method call(term:, guardian:)
    #   @param [String] term
    #   @param [Guardian] guardian
    #   @return [Service::Base::Context]

    contract
    step :clean_term
    model :memberships, optional: true
    model :users, optional: true
    model :groups, optional: true
    model :category_channels, optional: true
    model :direct_message_channels, optional: true

    # @!visibility private
    class Contract
      attribute :term, :string, default: ""
      attribute :include_users, :boolean, default: true
      attribute :include_groups, :boolean, default: true
      attribute :include_category_channels, :boolean, default: true
      attribute :include_direct_message_channels, :boolean, default: true
      attribute :excluded_memberships_channel_id, :integer
    end

    private

    def clean_term(contract:)
      context.term = contract.term.downcase&.gsub(/^#+/, "")&.gsub(/^@+/, "")&.strip
    end

    def fetch_memberships(guardian:)
      ::Chat::ChannelMembershipManager.all_for_user(guardian.user)
    end

    def fetch_users(guardian:, contract:)
      return unless contract.include_users
      return unless guardian.can_create_direct_message?
      search_users(context, guardian, contract)
    end

    def fetch_groups(guardian:, contract:)
      return unless contract.include_groups
      return unless guardian.can_create_direct_message?
      search_groups(context, guardian, contract)
    end

    def fetch_category_channels(guardian:, contract:)
      return unless contract.include_category_channels
      return if !SiteSetting.enable_public_channels

      ::Chat::ChannelFetcher.secured_public_channel_search(
        guardian,
        filter_on_category_name: false,
        match_filter_on_starts_with: false,
        filter: context.term,
        status: :open,
        limit: 10,
      )
    end

    def fetch_direct_message_channels(guardian:, users:, contract:, **args)
      return unless contract.include_direct_message_channels

      channels =
        ::Chat::ChannelFetcher.secured_direct_message_channels_search(
          guardian.user.id,
          guardian,
          limit: 10,
          match_filter_on_starts_with: false,
          filter: context.term,
        ) || []

      if users && contract.include_users
        user_ids = users.map(&:id)
        channels =
          channels.reject do |channel|
            channel_user_ids = channel.allowed_user_ids - [guardian.user.id]
            channel.allowed_user_ids.length == 1 &&
              user_ids.include?(channel.allowed_user_ids.first) ||
              channel_user_ids.length == 1 && user_ids.include?(channel_user_ids.first)
          end
      end

      channels
    end

    def search_users(context, guardian, contract)
      user_search = ::UserSearch.new(context.term, limit: 10)

      if context.term.blank?
        user_search = user_search.scoped_users
      else
        user_search = user_search.search
      end

      allowed_bot_user_ids =
        DiscoursePluginRegistry.apply_modifier(:chat_allowed_bot_user_ids, [], guardian)

      user_search = user_search.real(allowed_bot_user_ids: allowed_bot_user_ids)
      user_search = user_search.includes(:user_option)

      if context.excluded_memberships_channel_id
        user_search =
          user_search.where(
            "NOT EXISTS (
      SELECT 1
      FROM user_chat_channel_memberships
      WHERE user_chat_channel_memberships.user_id = users.id AND user_chat_channel_memberships.chat_channel_id = ?
    )",
            context.excluded_memberships_channel_id,
          )
      end

      user_search
    end

    def search_groups(context, guardian, contract)
      Group
        .visible_groups(guardian.user)
        .includes(users: :user_option)
        .where(
          "groups.name ILIKE :term_like OR groups.full_name ILIKE :term_like",
          term_like: "%#{context.term}%",
        )
    end
  end
end
