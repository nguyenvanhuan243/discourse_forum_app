# frozen_string_literal: true

Discourse::Application.configure do
  # Settings specified here will take precedence over those in config/application.rb

  # Code is not reloaded between requests
  config.cache_classes = true
  config.eager_load = true

  # Full error reports are disabled and caching is turned on
  config.consider_all_requests_local = false
  config.action_controller.perform_caching = true

  # Disable Rails's static asset server (Apache or nginx will already do this)
  config.public_file_server.enabled = GlobalSetting.serve_static_assets || false

  config.assets.js_compressor = :uglifier

  # stuff should be pre-compiled
  config.assets.compile = false

  # Generate digests for assets URLs
  config.assets.digest = true

  config.log_level = :info

  if (smtp_settings = GlobalSetting.smtp_settings).present?
    config.action_mailer.smtp_settings = smtp_settings
  else
    config.action_mailer.delivery_method = :sendmail
    config.action_mailer.sendmail_settings = { arguments: "-i" }
  end

  # Send deprecation notices to registered listeners
  config.active_support.deprecation = :notify

  # allows developers to use mini profiler
  config.load_mini_profiler = GlobalSetting.load_mini_profiler

  # Discourse strongly recommend you use a CDN.
  # For origin pull cdns all you need to do is register an account and configure
  config.action_controller.asset_host = GlobalSetting.cdn_url

  # a comma delimited list of emails your devs have
  # developers have god like rights and may impersonate anyone in the system
  # normal admins may only impersonate other moderators (not admins)
  if emails = GlobalSetting.developer_emails
    config.developer_emails = emails.split(",").map(&:downcase).map(&:strip)
  end

  config.active_record.dump_schema_after_migration = false

  if ENV["RAILS_LOG_TO_STDOUT"].present?
    config.logger = ActiveSupport::TaggedLogging.new(Logger.new(STDOUT))
  end

  config.active_record.action_on_strict_loading_violation = :log
end
