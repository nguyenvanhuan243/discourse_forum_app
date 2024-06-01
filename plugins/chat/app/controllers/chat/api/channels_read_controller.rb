# frozen_string_literal: true

class Chat::Api::ChannelsReadController < Chat::ApiController
  def update
    with_service(Chat::UpdateUserChannelLastRead) do
      on_success { render(json: success_json) }
      on_failure { render(json: failed_json, status: 422) }
      on_failed_policy(:ensure_message_id_recency) do
        raise Discourse::InvalidParameters.new(:message_id)
      end
      on_model_not_found(:message) { raise Discourse::NotFound }
      on_model_not_found(:membership) { raise Discourse::NotFound }
      on_model_not_found(:channel) { raise Discourse::NotFound }
      on_failed_policy(:invalid_access) { raise Discourse::InvalidAccess }
      on_failed_contract do |contract|
        render(json: failed_json.merge(errors: contract.errors.full_messages), status: 400)
      end
    end
  end

  def update_all
    with_service(Chat::MarkAllUserChannelsRead) do
      on_success do
        render(json: success_json.merge(updated_memberships: result.updated_memberships))
      end
      on_failure { render(json: failed_json, status: 422) }
    end
  end
end
