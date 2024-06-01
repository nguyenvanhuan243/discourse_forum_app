# frozen_string_literal: true

RSpec.describe Jobs::PendingReviewablesReminder do
  let(:job) { described_class.new }

  def create_flag(created_at)
    PostActionCreator.create(
      Fabricate(:user, refresh_auto_groups: true),
      Fabricate(:post),
      :spam,
      created_at: created_at,
    ).reviewable
  end

  def execute
    job.tap { job.execute({}) }
  end

  it "doesn't notify when there are no flags" do
    expect(execute.sent_reminder).to eq(false)
  end

  context "when notify_about_reviewable_item_after is 0" do
    before { SiteSetting.notify_about_reviewable_item_after = 0 }

    it "never notifies" do
      create_flag(50.hours.ago)
      expect(execute.sent_reminder).to eq(false)
    end
  end

  context "when notify_about_reviewable_item_after accepts a float" do
    before { SiteSetting.notify_about_reviewable_item_after = 0.25 }

    it "doesn't send message when flags are less than 15 minutes old" do
      create_flag(14.minutes.ago)
      expect(execute.sent_reminder).to eq(false)
    end

    it "sends message when there is a flag older than 15 minutes" do
      create_flag(16.minutes.ago)
      expect(execute.sent_reminder).to eq(true)
    end
  end

  context "when notify_about_reviewable_item_after is 48" do
    before do
      SiteSetting.notify_about_reviewable_item_after = 48
      described_class.clear_key
    end

    after { described_class.clear_key }

    it "doesn't send message when flags are less than 48 hours old" do
      create_flag(47.hours.ago)
      expect(execute.sent_reminder).to eq(false)
    end

    it "doesn't send a message if there are no new flags older than 48 hours old" do
      old_reviewable = create_flag(50.hours.ago)
      create_flag(47.hours.ago)

      described_class.last_notified_id = old_reviewable.id
      execute
      expect(job.sent_reminder).to eq(false)
      expect(described_class.last_notified_id).to eq(old_reviewable.id)
    end

    it "sends message when there is a flag older than 48 hours" do
      create_flag(49.hours.ago)
      expect(execute.sent_reminder).to eq(true)
    end

    context "with reviewable_default_visibility" do
      before do
        create_flag(49.hours.ago)
        create_flag(51.hours.ago)
      end

      it "doesn't send a message when `reviewable_default_visibility` is not met" do
        Reviewable.set_priorities(medium: 3.0)
        SiteSetting.reviewable_default_visibility = "medium"
        expect(execute.sent_reminder).to eq(false)
      end

      it "sends a message when `reviewable_default_visibility` is met" do
        Reviewable.set_priorities(medium: 2.0)
        SiteSetting.reviewable_default_visibility = "medium"
        expect(execute.sent_reminder).to eq(true)
      end
    end

    it "deletes previous messages" do
      GroupMessage.create(
        Group[:moderators].name,
        "reviewables_reminder",
        { limit_once_per: false, message_params: { mentions: "", count: 1 } },
      )

      create_flag(49.hours.ago)
      execute

      expect(
        Topic.where(title: I18n.t("system_messages.reviewables_reminder.subject_template")).count,
      ).to eq(1)
    end
  end
end
