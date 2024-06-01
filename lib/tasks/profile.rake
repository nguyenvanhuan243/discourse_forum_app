# frozen_string_literal: true

desc "generate a user api key for given user in profiling environment"
task "user_api_key:create", [:username] => :environment do |task, args|
  if ENV["RAILS_ENV"] != "profile"
    raise "user_api_key:create rake task is only meant for the profiling env"
  end
  raise "Supply a username for the key" if !args[:username]

  user = User.find_by_username(args[:username])

  raise "'#{args[:username]}' is not a valid username" if !user

  application_name = "perf test application"

  user_api_key = UserApiKey.where(application_name: application_name).destroy_all

  user_api_key =
    UserApiKey.create!(
      application_name: application_name,
      client_id: "1234",
      scopes: ["read"].map { |name| UserApiKeyScope.new(name: name) },
      user_id: user.id,
    )

  puts user_api_key.key
end
