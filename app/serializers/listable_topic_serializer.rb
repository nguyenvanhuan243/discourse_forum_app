# frozen_string_literal: true

class ListableTopicSerializer < BasicTopicSerializer
  attributes :reply_count,
             :highest_post_number,
             :image_url,
             :created_at,
             :last_posted_at,
             :bumped,
             :bumped_at,
             :archetype,
             :unseen,
             :last_read_post_number,
             :unread,
             :new_posts,
             :unread_posts,
             :pinned,
             :unpinned,
             :excerpt,
             :visible,
             :closed,
             :archived,
             :is_warning,
             :notification_level,
             :bookmarked,
             :liked,
             :unicode_title,
             :unread_by_group_member,
             :thumbnails,
             :visibility_reason_id

  has_one :last_poster, serializer: BasicUserSerializer, embed: :objects

  def image_url
    object.image_url(enqueue_if_missing: true)
  end

  def thumbnails
    extra_sizes = theme_modifier_helper.topic_thumbnail_sizes
    object.thumbnail_info(enqueue_if_missing: true, extra_sizes: extra_sizes)
  end

  def include_thumbnails?
    theme_modifier_helper.topic_thumbnail_sizes.present? ||
      DiscoursePluginRegistry.topic_thumbnail_sizes.present?
  end

  def include_unicode_title?
    object.title.match?(/:[\w\-+]+:/)
  end

  def unicode_title
    Emoji.gsub_emoji_to_unicode(object.title)
  end

  def highest_post_number
    (scope.is_whisperer? && object.highest_staff_post_number) || object.highest_post_number
  end

  def liked
    object.user_data && object.user_data.liked
  end

  def bookmarked
    object.user_data && object.user_data.bookmarked
  end

  def include_last_poster?
    object.include_last_poster
  end

  def bumped
    object.created_at < object.bumped_at
  end

  def seen
    return true if !scope || !scope.user
    return true if object.user_data && !object.user_data.last_read_post_number.nil?
    return true if object.dismissed
    return true if object.created_at < scope.user.user_option.treat_as_new_topic_start_date
    false
  end

  def is_warning
    object.subtype == TopicSubtype.moderator_warning
  end

  def include_is_warning?
    is_warning
  end

  def unseen
    !seen
  end

  def notification_level
    object.user_data.notification_level
  end

  def include_notification_level?
    object.user_data.present?
  end

  def last_read_post_number
    return nil unless object.user_data
    object.user_data.last_read_post_number
  end

  def has_user_data
    !!object.user_data
  end

  def excerpt
    object.excerpt
  end

  alias include_last_read_post_number? has_user_data

  # TODO: For backwards compatibility with themes,
  #       Remove once Discourse 2.8 is released
  def unread
    0
  end
  alias include_unread? has_user_data

  # TODO: For backwards compatibility with themes,
  #       Remove once Discourse 2.8 is released
  def new_posts
    unread_helper.unread_posts
  end
  alias include_new_posts? has_user_data

  def unread_posts
    unread_helper.unread_posts
  end
  alias include_unread_posts? has_user_data

  def include_excerpt?
    pinned || SiteSetting.always_include_topic_excerpts ||
      theme_modifier_helper.serialize_topic_excerpts
  end

  def pinned
    PinnedCheck.pinned?(object, object.user_data)
  end

  def unpinned
    PinnedCheck.unpinned?(object, object.user_data)
  end

  def unread_by_group_member
    # object#last_read_post_number is an attribute selected from a joined table.
    # See TopicQuery#append_read_state for more information.
    return false unless object.respond_to?(:last_read_post_number)

    object.last_read_post_number < object.highest_post_number
  end

  def include_unread_by_group_member?
    !!object.topic_list&.publish_read_state
  end

  def include_visibility_reason_id?
    object.visibility_reason_id.present?
  end

  protected

  def unread_helper
    @unread_helper ||= Unread.new(object, object.user_data, scope)
  end

  private

  def theme_modifier_helper
    @theme_modifier_helper ||= ThemeModifierHelper.new(request: scope.request)
  end
end
