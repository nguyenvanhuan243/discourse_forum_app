# frozen_string_literal: true

RSpec.describe TopicListItemSerializer do
  let(:topic) do
    date = Time.zone.now

    Fabricate(
      :topic,
      title: "This is a test topic title",
      created_at: date - 2.minutes,
      bumped_at: date,
    )
  end

  it "correctly serializes topic" do
    SiteSetting.topic_featured_link_enabled = true
    serialized = TopicListItemSerializer.new(topic, scope: Guardian.new, root: false).as_json

    expect(serialized[:title]).to eq("This is a test topic title")
    expect(serialized[:bumped]).to eq(true)
    expect(serialized[:featured_link]).to eq(nil)
    expect(serialized[:featured_link_root_domain]).to eq(nil)

    featured_link = "http://meta.discourse.org"
    topic.featured_link = featured_link
    serialized = TopicListItemSerializer.new(topic, scope: Guardian.new, root: false).as_json

    expect(serialized[:featured_link]).to eq(featured_link)
    expect(serialized[:featured_link_root_domain]).to eq("discourse.org")
  end

  describe "when topic featured link is disable" do
    before { SiteSetting.topic_featured_link_enabled = false }

    it "should not include the topic's featured link" do
      topic.featured_link = "http://meta.discourse.org"
      serialized = TopicListItemSerializer.new(topic, scope: Guardian.new, root: false).as_json

      expect(serialized[:featured_link]).to eq(nil)
      expect(serialized[:featured_link_root_domain]).to eq(nil)
    end
  end

  describe "hidden tags" do
    let(:admin) { Fabricate(:admin) }
    let(:user) { Fabricate(:user) }
    let(:hidden_tag) { Fabricate(:tag, name: "hidden", description: "a" * 1000) }
    let(:staff_tag_group) do
      Fabricate(:tag_group, permissions: { "staff" => 1 }, tag_names: [hidden_tag.name])
    end

    before do
      SiteSetting.tagging_enabled = true
      staff_tag_group
      topic.tags << hidden_tag
    end

    it "returns hidden tag to staff" do
      json = TopicListItemSerializer.new(topic, scope: Guardian.new(admin), root: false).as_json

      expect(json[:tags]).to eq([hidden_tag.name])
    end

    it "trucates description" do
      json = TopicListItemSerializer.new(topic, scope: Guardian.new(admin), root: false).as_json
      expect(json[:tags_descriptions]).to eq({ "hidden" => "a" * 77 + "..." })
    end

    it "does not return hidden tag to non-staff" do
      json = TopicListItemSerializer.new(topic, scope: Guardian.new(user), root: false).as_json

      expect(json[:tags]).to eq([])
    end

    it "accepts an option to remove hidden tags" do
      json =
        TopicListItemSerializer.new(
          topic,
          scope: Guardian.new(user),
          hidden_tag_names: [hidden_tag.name],
          root: false,
        ).as_json

      expect(json[:tags]).to eq([])
    end

    it "return posters" do
      json =
        TopicListItemSerializer.new(
          topic,
          scope: Guardian.new(user),
          hidden_tag_names: [hidden_tag.name],
          root: false,
        ).as_json

      expect(json[:posters].length).to eq(1)
    end
  end
end
