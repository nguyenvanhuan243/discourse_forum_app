# frozen_string_literal: true

RSpec.describe "Keyboard shortcuts", type: :system do
  describe "<a>" do
    let(:current_user) { topic.user }
    let(:topic_page) { PageObjects::Pages::Topic.new }

    before { sign_in(current_user) }

    context "when on a private message page" do
      fab!(:topic) { Fabricate(:private_message_topic) }

      context "when the message is not archived" do
        it "archives the message" do
          topic_page.visit_topic(topic)
          send_keys("a")
          expect(page).to have_current_path("/u/#{current_user.username}/messages")
          expect(UserArchivedMessage.exists?(topic: topic)).to be true
        end
      end

      context "when the message is already archived" do
        before { UserArchivedMessage.create!(topic: topic, user: current_user) }

        it "moves back the message to inbox" do
          topic_page.visit_topic(topic)
          send_keys("a")
          expect(page).to have_current_path("/u/#{current_user.username}/messages")
          expect(UserArchivedMessage.exists?(topic: topic)).to be false
        end
      end
    end

    context "when on a public topic page" do
      fab!(:topic)

      it "doesn't archive the topic" do
        topic_page.visit_topic(topic)
        send_keys("a")
        expect(page).to have_current_path("/t/#{topic.slug}/#{topic.id}")
        expect(UserArchivedMessage.exists?(topic: topic)).to be false
      end
    end
  end
end
