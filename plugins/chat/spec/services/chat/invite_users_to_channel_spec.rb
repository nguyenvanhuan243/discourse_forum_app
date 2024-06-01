# frozen_string_literal: true

RSpec.describe Chat::InviteUsersToChannel do
  subject(:result) { described_class.call(params) }

  describe described_class::Contract, type: :model do
    subject(:contract) { described_class.new }

    it { is_expected.to validate_presence_of :channel_id }
    it { is_expected.to validate_presence_of :user_ids }
  end

  fab!(:current_user) { Fabricate(:admin) }
  fab!(:user_1) { Fabricate(:user) }
  fab!(:user_2) { Fabricate(:user) }
  fab!(:channel_1) { Fabricate(:chat_channel) }
  fab!(:group_1) { Fabricate(:group) }

  let(:guardian) { current_user.guardian }
  let(:user_ids) { [user_1.id, user_2.id] }
  let(:message_id) { nil }
  let(:params) do
    { guardian: guardian, channel_id: channel_1.id, message_id: message_id, user_ids: user_ids }
  end

  before do
    group_1.add(user_1)
    SiteSetting.chat_allowed_groups = [group_1].map(&:id).join("|")
  end

  context "when all steps pass" do
    it "sets the service result as successful" do
      expect(result).to run_service_successfully
    end

    it "creates the notifications for allowed users" do
      result

      notification = user_1.reload.notifications.last
      expect(notification.notification_type).to eq(::Notification.types[:chat_invitation])

      notification = user_2.reload.notifications.last
      expect(notification).to be_nil
    end

    it "doesnt create notifications for suspended users" do
      user_1.update!(suspended_till: 2.days.from_now, suspended_at: Time.now)

      result

      notification = user_1.reload.notifications.last
      expect(notification).to be_nil
    end

    it "doesnt create notifications for users with disabled chat" do
      user_1.user_option.update!(chat_enabled: false)

      result

      notification = user_1.reload.notifications.last
      expect(notification).to be_nil
    end

    context "when message id is provided" do
      fab!(:message_1) { Fabricate(:chat_message, chat_channel: channel_1) }

      let(:message_id) { message_1.id }

      it "sets the message id on the notification" do
        result

        data = JSON.parse(user_1.reload.notifications.last.data)
        expect(data["chat_message_id"]).to eq(message_id)
      end
    end
  end

  context "when channel model is not found" do
    before { params[:channel_id] = -1 }

    it { is_expected.to fail_to_find_a_model(:channel) }
  end

  context "when current user can't view channel" do
    fab!(:current_user) { Fabricate(:user) }
    fab!(:channel_1) { Fabricate(:private_category_channel) }

    it { is_expected.to fail_a_policy(:can_view_channel) }
  end
end
