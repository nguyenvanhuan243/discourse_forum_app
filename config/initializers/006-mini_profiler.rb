# frozen_string_literal: true

# If Mini Profiler is included via gem
if Rails.configuration.respond_to?(:load_mini_profiler) && Rails.configuration.load_mini_profiler &&
     RUBY_ENGINE == "ruby"
  require "rack-mini-profiler"
  require "stackprof"

  begin
    require "memory_profiler"
  rescue => e
    STDERR.put "#{e} failed to require mini profiler"
  end

  # initialization is skipped so trigger it
  Rack::MiniProfilerRails.initialize!(Rails.application)
end

if defined?(Rack::MiniProfiler) && defined?(Rack::MiniProfiler::Config)
  # note, we may want to add some extra security here that disables mini profiler in a multi hosted env unless user global admin
  #   raw_connection means results are not namespaced
  #
  # namespacing gets complex, cause mini profiler is in the rack chain way before multisite
  Rack::MiniProfiler.config.storage_instance =
    Rack::MiniProfiler::RedisStore.new(connection: DiscourseRedis.new(nil, namespace: false))

  Rack::MiniProfiler.config.snapshot_every_n_requests = GlobalSetting.mini_profiler_snapshots_period
  Rack::MiniProfiler.config.snapshots_transport_destination_url =
    GlobalSetting.mini_profiler_snapshots_transport_url
  Rack::MiniProfiler.config.snapshots_transport_auth_key =
    GlobalSetting.mini_profiler_snapshots_transport_auth_key
  Rack::MiniProfiler.config.skip_paths =
    %w[
      /assets/
      /cdn_asset/
      /extra-locales/
      /favicon/proxied
      /highlight-js/
      /images/
      /javascripts/
      /letter_avatar_proxy/
      /letter_avatar/
      /logs
      /manifest.webmanifest
      /message-bus/
      /opensearch.xml
      /presence/
      /secure-media-uploads/
      /secure-uploads/
      /srv/status
      /stylesheets/
      /svg-sprite/
      /theme-javascripts
      /topics/timings
      /uploads/
      /user_avatar/
    ].map { |path| "#{Discourse.base_path}#{path}" }.concat([/.*theme-qunit/])

  # we DO NOT WANT mini-profiler loading on anything but real desktops and laptops
  # so let's rule out all handheld, tablet, and mobile devices
  Rack::MiniProfiler.config.pre_authorize_cb =
    lambda { |env| env["HTTP_USER_AGENT"] !~ /iPad|iPhone|Android/ }

  # without a user provider our results will use the ip address for namespacing
  #  with a load balancer in front this becomes really bad as some results can
  #  be stored associated with ip1 as the user and retrieved using ip2 causing 404s
  Rack::MiniProfiler.config.user_provider =
    lambda do |env|
      request = Rack::Request.new(env)
      id = request.cookies["_t"] || request.ip || "unknown"
      id = id.to_s
      # some security, lets not have these tokens floating about
      Digest::MD5.hexdigest(id)
    end

  # Cookie path should be set to the base path so Discourse's session cookie path
  #  does not get clobbered.
  Rack::MiniProfiler.config.cookie_path = Discourse.base_path.presence || "/"

  Rack::MiniProfiler.config.position = "right"

  Rack::MiniProfiler.config.backtrace_ignores ||= []
  Rack::MiniProfiler.config.backtrace_ignores << %r{lib/rack/message_bus.rb}
  Rack::MiniProfiler.config.backtrace_ignores << %r{config/initializers/silence_logger}
  Rack::MiniProfiler.config.backtrace_ignores << %r{config/initializers/quiet_logger}

  Rack::MiniProfiler.config.backtrace_includes = [%r{^/?(app|config|lib|test|plugins)}]

  Rack::MiniProfiler.config.max_traces_to_show = 100 if Rails.env.development?

  Rack::MiniProfiler.config.content_security_policy_nonce =
    Proc.new do |env, headers|
      if csp = headers["Content-Security-Policy"]
        csp[/script-src[^;]+'nonce-([^']+)'/, 1]
      end
    end

  Rack::MiniProfiler.counter_method(Redis::Client, :call) { "redis" }
  # Rack::MiniProfiler.counter_method(ActiveRecord::QueryMethods, 'build_arel')
  # Rack::MiniProfiler.counter_method(Array, 'uniq')
  # require "#{Rails.root}/vendor/backports/notification"

  # inst = Class.new
  # class << inst
  #   def start(name,id,payload)
  #     if Rack::MiniProfiler.current && name !~ /(process_action.action_controller)|(render_template.action_view)/
  #       @prf ||= {}
  #       @prf[id] ||= []
  #       @prf[id] << Rack::MiniProfiler.start_step("#{payload[:serializer] if name =~ /serialize.serializer/} #{name}")
  #     end
  #   end

  #   def finish(name,id,payload)
  #     if Rack::MiniProfiler.current && name !~ /(process_action.action_controller)|(render_template.action_view)/
  #       t = @prf[id].pop
  #       @prf.delete id unless t
  #       Rack::MiniProfiler.finish_step t
  #     end
  #   end
  # end
  # disabling for now cause this slows stuff down too much
  # ActiveSupport::Notifications.subscribe(/.*/, inst)

  # Rack::MiniProfiler.profile_method ActionView::PathResolver, 'find_templates'
end

if ENV["PRINT_EXCEPTIONS"]
  trace =
    TracePoint.new(:raise) do |tp|
      puts tp.raised_exception
      puts tp.raised_exception.backtrace.join("\n")
      puts
    end
  trace.enable
end
