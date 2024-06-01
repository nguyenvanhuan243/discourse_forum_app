# frozen_string_literal: true

describe "Topic bulk select", type: :system do
  before { SiteSetting.experimental_topic_bulk_actions_enabled_groups = "1" }
  fab!(:topics) { Fabricate.times(10, :post).map(&:topic) }
  fab!(:admin)
  fab!(:user)

  let(:topic_list_header) { PageObjects::Components::TopicListHeader.new }
  let(:topic_list) { PageObjects::Components::TopicList.new }
  let(:topic_page) { PageObjects::Pages::Topic.new }
  let(:topic_bulk_actions_modal) { PageObjects::Modals::TopicBulkActions.new }

  context "when appending tags" do
    fab!(:tag1) { Fabricate(:tag) }
    fab!(:tag2) { Fabricate(:tag) }
    fab!(:tag3) { Fabricate(:tag) }

    before { SiteSetting.tagging_enabled = true }

    def open_append_modal(topics_to_select = nil)
      sign_in(admin)
      visit("/latest")

      topic_list_header.click_bulk_select_button

      if !topics_to_select
        topic_list.click_topic_checkbox(topics.last)
      else
        topics_to_select.each { |topic| topic_list.click_topic_checkbox(topic) }
      end

      topic_list_header.click_bulk_select_topics_dropdown
      topic_list_header.click_bulk_button("append-tags")
      expect(topic_bulk_actions_modal).to be_open
    end

    it "appends tags to selected topics" do
      open_append_modal

      topic_bulk_actions_modal.tag_selector.expand
      topic_bulk_actions_modal.tag_selector.search(tag1.name)
      topic_bulk_actions_modal.tag_selector.select_row_by_value(tag1.name)
      topic_bulk_actions_modal.tag_selector.search(tag2.name)
      topic_bulk_actions_modal.tag_selector.select_row_by_value(tag2.name)

      topic_bulk_actions_modal.click_bulk_topics_confirm

      expect(
        find(topic_list.topic_list_item_class(topics.last)).find(".discourse-tags"),
      ).to have_content(tag1.name)
      expect(
        find(topic_list.topic_list_item_class(topics.last)).find(".discourse-tags"),
      ).to have_content(tag2.name)
    end

    context "when selecting topics in different categories" do
      before do
        topics
          .last(2)
          .each do |topic|
            topic.update!(category: Fabricate(:category))
            topic.update!(category: Fabricate(:category))
          end
      end

      it "does not show an additional note about the category in the modal" do
        open_append_modal(topics.last(2))

        expect(topic_bulk_actions_modal).to have_no_category_badge(topics.last.reload.category)
      end
    end

    context "when selecting topics that are all in the same category" do
      fab!(:category)

      before { topics.last.update!(category_id: category.id) }

      it "shows an additional note about the category in the modal" do
        open_append_modal
        expect(topic_bulk_actions_modal).to have_category_badge(category)
      end

      it "allows for searching restricted tags for that category and other tags too if the category allows it" do
        restricted_tag_group = Fabricate(:tag_group)
        restricted_tag = Fabricate(:tag)
        TagGroupMembership.create!(tag: restricted_tag, tag_group: restricted_tag_group)
        CategoryTagGroup.create!(category: category, tag_group: restricted_tag_group)
        category.update!(allow_global_tags: true)

        open_append_modal

        topic_bulk_actions_modal.tag_selector.expand
        topic_bulk_actions_modal.tag_selector.search(restricted_tag.name)
        topic_bulk_actions_modal.tag_selector.select_row_by_value(restricted_tag.name)
        topic_bulk_actions_modal.tag_selector.search(tag1.name)
        topic_bulk_actions_modal.tag_selector.select_row_by_value(tag1.name)

        topic_bulk_actions_modal.click_bulk_topics_confirm

        expect(
          find(topic_list.topic_list_item_class(topics.last)).find(".discourse-tags"),
        ).to have_content(restricted_tag.name)
        expect(
          find(topic_list.topic_list_item_class(topics.last)).find(".discourse-tags"),
        ).to have_content(tag1.name)
      end
    end
  end

  context "when closing" do
    it "closes multiple topics" do
      sign_in(admin)
      visit("/latest")

      # Click bulk select button
      topic_list_header.click_bulk_select_button
      expect(topic_list).to have_topic_checkbox(topics.first)

      # Select Topics
      topic_list.click_topic_checkbox(topics.first)
      topic_list.click_topic_checkbox(topics.second)

      # Has Dropdown
      expect(topic_list_header).to have_bulk_select_topics_dropdown
      topic_list_header.click_bulk_select_topics_dropdown

      # Clicking the close button opens up the modal
      topic_list_header.click_bulk_button("close-topics")
      expect(topic_bulk_actions_modal).to be_open

      # Closes the selected topics
      topic_bulk_actions_modal.click_bulk_topics_confirm
      expect(topic_list).to have_closed_status(topics.first)
    end

    it "closes single topic" do
      # Watch the topic as a user
      sign_in(user)
      visit("/latest")
      topic = topics.third
      visit("/t/#{topic.slug}/#{topic.id}")
      topic_page.watch_topic
      expect(topic_page).to have_read_post(1)

      # Bulk close the topic as an admin
      sign_in(admin)
      visit("/latest")
      topic_list_header.click_bulk_select_button
      topic_list.click_topic_checkbox(topics.third)
      topic_list_header.click_bulk_select_topics_dropdown
      topic_list_header.click_bulk_button("close-topics")
      topic_bulk_actions_modal.click_bulk_topics_confirm

      # Check that the user did receive a new post notification badge
      sign_in(user)
      visit("/latest")
      expect(topic_list).to have_unread_badge(topics.third)
    end

    it "closes topics silently" do
      # Watch the topic as a user
      sign_in(user)
      topic = topics.first
      visit("/t/#{topic.slug}/#{topic.id}")
      expect(topic_page).to have_read_post(1)
      topic_page.watch_topic

      # Bulk close the topic as an admin
      sign_in(admin)
      visit("/latest")
      topic_list_header.click_bulk_select_button
      topic_list.click_topic_checkbox(topics.first)
      topic_list_header.click_bulk_select_topics_dropdown
      topic_list_header.click_bulk_button("close-topics")
      topic_bulk_actions_modal.click_silent # Check Silent
      topic_bulk_actions_modal.click_bulk_topics_confirm

      # Check that the user didn't receive a new post notification badge
      sign_in(user)
      visit("/latest")
      expect(topic_list).to have_no_unread_badge(topics.first)
    end

    it "closes topics with message" do
      # Bulk close the topic with a message
      sign_in(admin)
      visit("/latest")
      topic = topics.first
      topic_list_header.click_bulk_select_button
      topic_list.click_topic_checkbox(topics.first)
      topic_list_header.click_bulk_select_topics_dropdown
      topic_list_header.click_bulk_button("close-topics")

      # Fill in message
      topic_bulk_actions_modal.fill_in_close_note("None of these are useful")
      topic_bulk_actions_modal.click_bulk_topics_confirm

      # Check that the topic now has the message
      visit("/t/#{topic.slug}/#{topic.id}")
      expect(topic_page).to have_content("None of these are useful")
    end

    it "works with keyboard shortcuts" do
      sign_in(admin)
      visit("/latest")

      send_keys([:shift, "b"])
      send_keys("j")
      send_keys("x") # toggle select
      expect(topic_list).to have_checkbox_selected_on_row(1)

      send_keys("x") # toggle deselect
      expect(topic_list).to have_no_checkbox_selected_on_row(1)

      # watch topic and add a reply so we have something in /unread
      topic = topics.first
      visit("/t/#{topic.slug}/#{topic.id}")
      topic_page.watch_topic
      expect(topic_page).to have_read_post(1)
      Fabricate(:post, topic: topic)

      visit("/unread")
      expect(topic_list).to have_topics

      send_keys([:shift, "b"])
      send_keys("j")
      send_keys("x")
      send_keys([:shift, "d"])

      click_button("dismiss-read-confirm")

      expect(topic_list).to have_no_topics
    end
  end
end
