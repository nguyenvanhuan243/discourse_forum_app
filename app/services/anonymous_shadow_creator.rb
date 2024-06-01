# frozen_string_literal: true

class AnonymousShadowCreator
  attr_reader :user

  def self.get_master(user)
    new(user).get_master
  end

  def self.get(user)
    new(user).get
  end

  def initialize(user)
    @user = user
  end

  def get_master
    return unless user
    return unless SiteSetting.allow_anonymous_posting

    user.master_user
  end

  def get
    return unless user
    return unless SiteSetting.allow_anonymous_posting
    return if !user.in_any_groups?(SiteSetting.anonymous_posting_allowed_groups_map)
    return if SiteSetting.must_approve_users? && !user.approved?

    shadow = user.shadow_user

    if shadow && (shadow.post_count + shadow.topic_count) > 0 && shadow.last_posted_at &&
         shadow.last_posted_at < SiteSetting.anonymous_account_duration_minutes.minutes.ago
      shadow = nil
    end

    shadow || create_shadow!
  end

  private

  def create_shadow!
    username = resolve_username

    User.transaction do
      shadow =
        User.create!(
          password: SecureRandom.hex,
          email: "#{SecureRandom.hex}@anon.#{Discourse.current_hostname}",
          skip_email_validation: true,
          name: username, # prevents error when names are required
          username: username,
          active: true,
          trust_level: 1,
          manual_locked_trust_level: 1,
          approved: true,
          approved_at: 1.day.ago,
          created_at: 1.day.ago, # bypass new user restrictions
        )

      shadow.user_option.update_columns(
        email_messages_level: UserOption.email_level_types[:never],
        email_digests: false,
      )

      shadow.email_tokens.update_all(confirmed: true)
      shadow.activate

      AnonymousUser.where(master_user_id: user.id, active: true).update_all(active: false)
      AnonymousUser.create!(user_id: shadow.id, master_user_id: user.id, active: true)

      shadow.reload
      user.reload

      shadow
    end
  end

  def resolve_username
    username = I18n.t("anonymous").downcase
    username = "anonymous" if UserNameSuggester.sanitize_username(username).blank?

    UserNameSuggester.suggest(username)
  end
end
