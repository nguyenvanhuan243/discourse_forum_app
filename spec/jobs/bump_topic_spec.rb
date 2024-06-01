# frozen_string_literal: true

RSpec.describe Jobs::BumpTopic do
  fab!(:admin)
  fab!(:user)

  it "can bump a topic" do
    topic = Fabricate(:topic_timer, user: admin).topic
    create_post(topic: topic)

    freeze_time(2.hours.from_now)

    expect do
      described_class.new.execute(topic_timer_id: topic.public_topic_timer.id)
    end.to change { topic.posts.count }.by(1)

    expect(topic.reload.public_topic_timer).to eq(nil)
  end

  it "respects the guardian" do
    topic = Fabricate(:topic_timer, user: user).topic
    create_post(topic: topic)
    topic.category = Fabricate(:private_category, group: Fabricate(:group))
    topic.save!

    freeze_time(2.hours.from_now)

    expect do
      described_class.new.execute(topic_timer_id: topic.public_topic_timer.id)
    end.not_to change { topic.posts.count }

    expect(topic.reload.public_topic_timer).to eq(nil)
  end
end
