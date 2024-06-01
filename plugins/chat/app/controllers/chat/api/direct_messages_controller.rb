# frozen_string_literal: true

# TODO (martin) Remove this endpoint when we move to do the channel creation
# when a message is first sent to avoid double-request round trips for DMs.
class Chat::Api::DirectMessagesController < Chat::ApiController
  def create
    with_service(Chat::CreateDirectMessageChannel) do
      on_success do
        render_serialized(
          result.channel,
          Chat::ChannelSerializer,
          root: "channel",
          membership: result.membership,
        )
      end
      on_model_not_found(:target_users) { raise ActiveRecord::RecordNotFound }
      on_failed_policy(:satisfies_dms_max_users_limit) do |policy|
        render_json_dump({ error: policy.reason }, status: 400)
      end
      on_failed_policy(:can_create_direct_message) do |policy|
        render_json_dump({ error: I18n.t("chat.errors.invalid_direct_message") }, status: 400)
      end
      on_failed_policy(:actor_allows_dms) do
        render_json_error(I18n.t("chat.errors.actor_disallowed_dms"))
      end
      on_failed_policy(:targets_allow_dms_from_user) { |policy| render_json_error(policy.reason) }
      on_model_errors(:direct_message) do |model|
        render_json_error(model, type: :record_invalid, status: 422)
      end
      on_model_errors(:channel) do |model|
        render_json_error(model, type: :record_invalid, status: 422)
      end
      on_failure { render(json: failed_json, status: 422) }
      on_failed_contract do |contract|
        render(json: failed_json.merge(errors: contract.errors.full_messages), status: 400)
      end
    end
  end
end
