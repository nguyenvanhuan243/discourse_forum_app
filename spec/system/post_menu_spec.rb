# frozen_string_literal: true

describe "Post menu", type: :system, js: true do
  fab!(:current_user) { Fabricate(:user) }
  fab!(:topic)
  fab!(:post) { Fabricate(:post, topic: topic) }

  let(:topic_page) { PageObjects::Pages::Topic.new }

  before { sign_in(current_user) }

  describe "copy link" do
    let(:cdp) { PageObjects::CDP.new }

    before { cdp.allow_clipboard }

    it "copies the absolute link to the post when clicked" do
      topic_page.visit_topic(post.topic)
      topic_page.click_post_action_button(post, :copy_link)
      expect(cdp.read_clipboard).to eq(
        post.full_url(share_url: true) + "?u=#{current_user.username}",
      )
    end
  end
end
