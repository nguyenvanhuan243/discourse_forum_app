# frozen_string_literal: true

class UserActionsController < ApplicationController
  def index
    user_actions_params.require(:username)

    user =
      fetch_user_from_params(
        include_inactive:
          current_user.try(:staff?) || (current_user && SiteSetting.show_inactive_accounts),
      )
    offset = [0, user_actions_params[:offset].to_i].max
    action_types = (user_actions_params[:filter] || "").split(",").map(&:to_i)
    limit = user_actions_params.fetch(:limit, 30).to_i

    raise Discourse::NotFound unless guardian.can_see_profile?(user)
    raise Discourse::NotFound unless guardian.can_see_user_actions?(user, action_types)

    opts = {
      user_id: user.id,
      user: user,
      offset: offset,
      limit: limit,
      action_types: action_types,
      guardian: guardian,
      ignore_private_messages: params[:filter].blank?,
      acting_username: params[:acting_username],
    }

    stream = UserAction.stream(opts).to_a

    response = { user_actions: serialize_data(stream, UserActionSerializer) }

    if guardian.can_lazy_load_categories?
      category_ids = stream.map(&:category_id).compact.uniq
      categories = Category.secured(guardian).with_parents(category_ids)
      response[:categories] = serialize_data(categories, CategoryBadgeSerializer)
    end

    render json: response
  end

  def show
    params.require(:id)
    render_serialized(UserAction.stream_item(params[:id], guardian), UserActionSerializer)
  end

  private

  def user_actions_params
    @user_actions_params ||= params.permit(:username, :filter, :offset, :acting_username, :limit)
  end
end
