# frozen_string_literal: true

if ENV["DISCOURSE_DUMP_HEAP"] == "1"
  require "objspace"
  ObjectSpace.trace_object_allocations_start
end

require "rubygems"

# Set up gems listed in the Gemfile.
ENV["BUNDLE_GEMFILE"] ||= File.expand_path("../../Gemfile", __FILE__)

require "bundler/setup" if File.exist?(ENV["BUNDLE_GEMFILE"])

if (ENV["DISABLE_BOOTSNAP"] != "1")
  begin
    require "bootsnap/setup"
  rescue LoadError
    # not a strong requirement
  end
end

# Parallel spec system
if ENV["RAILS_ENV"] == "test" && ENV["TEST_ENV_NUMBER"]
  if ENV["TEST_ENV_NUMBER"] == ""
    n = 1
  else
    n = ENV["TEST_ENV_NUMBER"].to_i
  end

  port = 10_000 + n

  STDERR.puts "Setting up parallel test mode - starting Redis #{n} on port #{port}"

  `rm -rf tmp/test_data_#{n} && mkdir -p tmp/test_data_#{n}/redis`
  pid =
    Process.spawn("redis-server --dir tmp/test_data_#{n}/redis --port #{port}", out: "/dev/null")

  ENV["DISCOURSE_REDIS_PORT"] = port.to_s
  ENV["RAILS_DB"] = "discourse_test_#{n}"

  at_exit do
    Process.kill("SIGTERM", pid)
    Process.wait
  end
end
