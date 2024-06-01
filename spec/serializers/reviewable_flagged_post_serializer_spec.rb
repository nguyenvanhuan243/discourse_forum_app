# frozen_string_literal: true

RSpec.describe ReviewableFlaggedPostSerializer do
  fab!(:admin)

  it "includes the user fields for review" do
    p0 = Fabricate(:post)
    reviewable = PostActionCreator.spam(Fabricate(:user, refresh_auto_groups: true), p0).reviewable
    json =
      ReviewableFlaggedPostSerializer.new(reviewable, scope: Guardian.new(admin), root: nil).as_json
    expect(json[:cooked]).to eq(p0.cooked)
    expect(json[:raw]).to eq(p0.raw)
    expect(json[:target_url]).to eq(Discourse.base_url + p0.url)
    expect(json[:created_from_flag]).to eq(true)
  end

  it "works when the topic is deleted" do
    reviewable = Fabricate(:reviewable_queued_post)
    reviewable.topic.update(deleted_at: Time.now)
    reviewable.reload

    json =
      ReviewableQueuedPostSerializer.new(reviewable, scope: Guardian.new(admin), root: nil).as_json
    expect(json[:id]).to be_present
  end
end
