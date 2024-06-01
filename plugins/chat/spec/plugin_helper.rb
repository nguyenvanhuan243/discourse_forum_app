# frozen_string_literal: true

require "faker"

module ChatSystemHelpers
  def chat_system_bootstrap(user = Fabricate(:admin), channels_for_membership = [])
    # ensures we have one valid registered admin/user
    user.activate

    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]

    channels_for_membership.each do |channel|
      membership = channel.add(user)
      if channel.chat_messages.any?
        membership.update!(last_read_message_id: channel.chat_messages.last.id)
      end
    end

    Group.refresh_automatic_groups!
  end

  def chat_system_user_bootstrap(user:, channel:)
    user.activate
    user.user_option.update!(chat_enabled: true)
    Group.refresh_automatic_group!("trust_level_#{user.trust_level}".to_sym)
    channel.add(user)
  end

  def chat_thread_chain_bootstrap(channel:, users:, messages_count: 4, thread_attrs: {})
    last_user = nil
    last_message = nil

    users.each { |user| chat_system_user_bootstrap(user: user, channel: channel) }
    messages_count.times do |i|
      in_reply_to = i.zero? ? nil : last_message.id
      thread_id = i.zero? ? nil : last_message.thread_id
      last_user = ((users - [last_user]).presence || users).sample
      creator =
        Chat::CreateMessage.call(
          chat_channel_id: channel.id,
          in_reply_to_id: in_reply_to,
          thread_id: thread_id,
          guardian: last_user.guardian,
          message: Faker::Alphanumeric.alpha(number: SiteSetting.chat_minimum_message_length),
        )

      raise "#{creator.inspect_steps.inspect}\n\n#{creator.inspect_steps.error}" if creator.failure?
      last_message = creator.message_instance
    end

    last_message.thread.set_replies_count_cache(messages_count - 1, update_db: true)
    last_message.thread.update!(thread_attrs) if thread_attrs.any?
    last_message.thread
  end

  def thread_excerpt(message)
    message.excerpt
  end
end

module ChatSpecHelpers
  def service_failed!(result)
    raise RSpec::Expectations::ExpectationNotMetError.new(
            "Service failed, see below for step details:\n\n" + result.inspect_steps.inspect,
          )
  end

  def update_message!(message, text: nil, user: Discourse.system_user, upload_ids: nil)
    result =
      Chat::UpdateMessage.call(
        guardian: user.guardian,
        message_id: message.id,
        upload_ids: upload_ids,
        message: text,
        process_inline: true,
      )
    service_failed!(result) if result.failure?
    result.message_instance
  end

  def trash_message!(message, user: Discourse.system_user)
    result =
      Chat::TrashMessage.call(
        message_id: message.id,
        channel_id: message.chat_channel_id,
        guardian: user.guardian,
      )
    service_failed!(result) if result.failure?
    result
  end

  def restore_message!(message, user: Discourse.system_user)
    result =
      Chat::RestoreMessage.call(
        message_id: message.id,
        channel_id: message.chat_channel_id,
        guardian: user.guardian,
      )
    service_failed!(result) if result.failure?
    result
  end

  def add_users_to_channel(users, channel, user: Discourse.system_user)
    result =
      ::Chat::AddUsersToChannel.call(
        guardian: user.guardian,
        channel_id: channel.id,
        usernames: Array(users).map(&:username),
      )
    service_failed!(result) if result.failure?
    result
  end

  def create_draft(channel, thread: nil, user: Discourse.system_user, data: { message: "draft" })
    result =
      ::Chat::UpsertDraft.call(
        guardian: user.guardian,
        channel_id: channel.id,
        thread_id: thread&.id,
        data: data.to_json,
      )
    service_failed!(result) if result.failure?
    result
  end
end

RSpec.configure do |config|
  config.include ChatSystemHelpers, type: :system
  config.include ChatSpecHelpers

  config.expect_with :rspec do |c|
    # Or a very large value, if you do want to truncate at some point
    c.max_formatted_output_length = nil
  end
end
