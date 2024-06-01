# frozen_string_literal: true

class PageviewController < ApplicationController
  skip_before_action :check_xhr,
                     :redirect_to_login_if_required,
                     :preload_json,
                     :verify_authenticity_token

  def index
    # pageview tracking is handled by middleware
    render plain: "ok"
  end
end
