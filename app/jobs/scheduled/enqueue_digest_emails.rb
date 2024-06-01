# frozen_string_literal: true

module Jobs
  class EnqueueDigestEmails < ::Jobs::Scheduled
    every 30.minutes

    def execute(args)
      return if SiteSetting.disable_emails == "yes"
      return if SiteSetting.disable_digest_emails?
      return if SiteSetting.private_email?

      target_user_ids.each do |user_id|
        ::Jobs.enqueue(:user_email, type: "digest", user_id: user_id)
      end
    end

    def target_user_ids
      # Users who want to receive digest email within their chosen digest email frequency
      query =
        User
          .real
          .activated
          .not_staged
          .not_suspended
          .joins(:user_option, :user_stat, :user_emails)
          .where("user_options.email_digests")
          .where(
            "COALESCE(user_options.digest_after_minutes, ?) > 0",
            SiteSetting.default_email_digest_frequency,
          )
          .where("user_stats.bounce_score < ?", SiteSetting.bounce_score_threshold)
          .where("user_emails.primary")
          .where(
            "COALESCE(user_stats.digest_attempted_at, '2010-01-01') <= CURRENT_TIMESTAMP - ('1 MINUTE'::INTERVAL * COALESCE(user_options.digest_after_minutes, ?))",
            SiteSetting.default_email_digest_frequency,
          )
          .where(
            "COALESCE(last_seen_at, '2010-01-01') <= CURRENT_TIMESTAMP - ('1 MINUTE'::INTERVAL * COALESCE(user_options.digest_after_minutes, ?))",
            SiteSetting.default_email_digest_frequency,
          )
          .where(
            "COALESCE(last_seen_at, '2010-01-01') >= CURRENT_TIMESTAMP - ('1 DAY'::INTERVAL * ?)",
            SiteSetting.suppress_digest_email_after_days,
          )
          .order("user_stats.digest_attempted_at ASC NULLS FIRST")

      # If the site requires approval, make sure the user is approved
      query = query.where("approved OR moderator OR admin") if SiteSetting.must_approve_users?

      query = query.limit(GlobalSetting.max_digests_enqueued_per_30_mins_per_site)

      query.pluck(:id)
    end
  end
end
