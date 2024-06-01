# frozen_string_literal: true

module Jobs
  module Chat
    class PeriodicalUpdates < ::Jobs::Scheduled
      every 15.minutes

      def execute(args = nil)
        return if !SiteSetting.chat_enabled

        # TODO: Add rebaking of old messages (baked_version <
        # Chat::Message::BAKED_VERSION or baked_version IS NULL)
        ::Chat::Channel.ensure_consistency!
        ::Chat::Thread.ensure_consistency!
        nil
      end
    end
  end
end
