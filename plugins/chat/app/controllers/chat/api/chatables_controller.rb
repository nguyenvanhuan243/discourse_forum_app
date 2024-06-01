# frozen_string_literal: true

class Chat::Api::ChatablesController < Chat::ApiController
  before_action :ensure_logged_in

  def index
    with_service(::Chat::SearchChatable) do
      on_success { render_serialized(result, ::Chat::ChatablesSerializer, root: false) }
      on_failure { render(json: failed_json, status: 422) }
      on_failed_contract do |contract|
        render(json: failed_json.merge(errors: contract.errors.full_messages), status: 400)
      end
    end
  end
end
