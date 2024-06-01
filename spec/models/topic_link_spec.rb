# frozen_string_literal: true

RSpec.describe TopicLink do
  let(:test_uri) { URI.parse(Discourse.base_url) }
  fab!(:user) { Fabricate(:user, refresh_auto_groups: true) }
  fab!(:topic) { Fabricate(:topic, user: user, title: "unique topic name") }
  fab!(:post)

  it { is_expected.to validate_presence_of :url }

  it "can't link to the same topic" do
    ftl = TopicLink.new(url: "/t/#{topic.id}", topic_id: topic.id, link_topic_id: topic.id)
    expect(ftl.valid?).to eq(false)
  end

  describe "external links" do
    it "correctly handles links" do
      non_png = "https://b.com/#{SecureRandom.hex}"

      # prepare a title for one of the links
      stub_request(:get, non_png).with(
        headers: {
          "Accept" => "text/html,*/*",
          "Accept-Encoding" => "gzip",
          "Host" => "b.com",
        },
      ).to_return(
        status: 200,
        body: "<html><head><title>amazing</title></head></html>",
        headers: {
        },
      )

      # so we run crawl_topic_links
      Jobs.run_immediately!

      png_title = "#{SecureRandom.hex}.png"
      png = "https://awesome.com/#{png_title}"

      post = Fabricate(:post, raw: <<~RAW, user: user, topic: topic)
        http://a.com/
        #{non_png}
        http://#{"a" * 200}.com/invalid
        //b.com/#{"a" * 500}
        #{png}
      RAW

      TopicLink.extract_from(post)

      # we have a special rule for images title where we pull them out of the filename
      expect(topic.topic_links.where(url: png).pick(:title)).to eq(png_title)
      expect(topic.topic_links.where(url: non_png).pick(:title)).to eq("amazing")

      expect(topic.topic_links.pluck(:url)).to contain_exactly(
        png,
        non_png,
        "http://a.com/",
        "//b.com/#{"a" * 500}"[0...TopicLink.max_url_length],
      )

      old_ids = topic.topic_links.pluck(:id)

      TopicLink.extract_from(post)

      new_ids = topic.topic_links.pluck(:id)

      expect(new_ids).to contain_exactly(*old_ids)
    end
  end

  describe "internal links" do
    it "can exclude links with ?silent=true" do
      url = topic.url
      raw = "[silent link](#{url}?silent=true)"

      post = Fabricate(:post, user: user, raw: raw)

      TopicLink.extract_from(post)

      expect(topic.topic_links.count).to eq(0)
      expect(post.topic.topic_links.count).to eq(0)
    end

    it "extracts onebox" do
      other_topic = Fabricate(:topic, user: user)
      Fabricate(:post, topic: other_topic, user: user, raw: "some content for the first post")
      other_post =
        Fabricate(:post, topic: other_topic, user: user, raw: "some content for the second post")

      url =
        "http://#{test_uri.host}/t/#{other_topic.slug}/#{other_topic.id}/#{other_post.post_number}"
      invalid_url = "http://#{test_uri.host}/t/#{other_topic.slug}/9999999999999999999999999999999"

      Fabricate(:post, topic: topic, user: user, raw: "initial post")
      post =
        Fabricate(
          :post,
          topic: topic,
          user: user,
          raw: "Link to another topic:\n\n#{url}\n\n#{invalid_url}",
        )

      TopicLink.extract_from(post)

      link = topic.topic_links.first
      # should have a link
      expect(link).to be_present
      # should be the canonical URL
      expect(link.url).to eq(url)
    end

    context "with topic link" do
      fab!(:other_topic) { Fabricate(:topic, user: user) }
      fab!(:moderator)

      let(:post) { Fabricate(:post, topic: other_topic, user: user, raw: "some content") }

      it "works" do
        # ensure other_topic has a post
        post

        url = "http://#{test_uri.host}/t/#{other_topic.slug}/#{other_topic.id}"

        Fabricate(:post, topic: topic, user: user, raw: "initial post")
        linked_post =
          Fabricate(:post, topic: topic, user: user, raw: "Link to another topic: #{url}")

        # this is subtle, but we had a bug were second time
        # TopicLink.extract_from was called a reflection was nuked
        2.times do
          TopicLink.extract_from(linked_post)

          topic.reload
          other_topic.reload

          link = topic.topic_links.first
          expect(link).to be_present
          expect(link).to be_internal
          expect(link.url).to eq(url)
          expect(link.domain).to eq(test_uri.host)
          expect(link.link_topic_id).to eq(other_topic.id)
          expect(link).not_to be_reflection

          reflection = other_topic.topic_links.first

          expect(reflection).to be_present
          expect(reflection).to be_reflection
          expect(reflection.post_id).to be_present
          expect(reflection.domain).to eq(test_uri.host)
          expect(reflection.url).to eq(
            "http://#{test_uri.host}/t/unique-topic-name/#{topic.id}/#{linked_post.post_number}",
          )
          expect(reflection.link_topic_id).to eq(topic.id)
          expect(reflection.link_post_id).to eq(linked_post.id)

          expect(reflection.user_id).to eq(link.user_id)
        end

        PostOwnerChanger.new(
          post_ids: [linked_post.id],
          topic_id: topic.id,
          acting_user: user,
          new_owner: Fabricate(:user),
        ).change_owner!

        TopicLink.extract_from(linked_post)
        expect(topic.topic_links.first.url).to eq(url)

        linked_post.revise(post.user, raw: "no more linkies https://eviltrout.com")
        expect(other_topic.reload.topic_links.where(link_post_id: linked_post.id)).to be_blank
      end

      it "works without id" do
        post
        url = "http://#{test_uri.host}/t/#{other_topic.slug}"
        Fabricate(:post, topic: topic, user: user, raw: "initial post")
        linked_post =
          Fabricate(:post, topic: topic, user: user, raw: "Link to another topic: #{url}")

        TopicLink.extract_from(linked_post)
        link = topic.topic_links.first

        reflection = other_topic.topic_links.first

        expect(reflection).to be_present
        expect(reflection).to be_reflection
        expect(reflection.post_id).to be_present
        expect(reflection.domain).to eq(test_uri.host)
        expect(reflection.url).to eq(
          "http://#{test_uri.host}/t/unique-topic-name/#{topic.id}/#{linked_post.post_number}",
        )
        expect(reflection.link_topic_id).to eq(topic.id)
        expect(reflection.link_post_id).to eq(linked_post.id)
        expect(reflection.user_id).to eq(link.user_id)
      end

      it "doesn't work for a deleted post" do
        post
        url = "http://#{test_uri.host}/t/#{other_topic.slug}/#{other_topic.id}"

        Fabricate(:post, topic: topic, user: user, raw: "initial post")
        linked_post =
          Fabricate(:post, topic: topic, user: user, raw: "Link to another topic: #{url}")
        TopicLink.extract_from(linked_post)
        expect(other_topic.reload.topic_links.where(link_post_id: linked_post.id).count).to eq(1)

        PostDestroyer.new(moderator, linked_post).destroy
        TopicLink.extract_from(linked_post)
        expect(other_topic.reload.topic_links.where(link_post_id: linked_post.id)).to be_blank
      end

      it "truncates long links" do
        SiteSetting.slug_generation_method = "encoded"
        long_title = "Καλημερα σε ολους και ολες" * 9 # 234 chars, but the encoded slug will be 1224 chars in length
        other_topic = Fabricate(:topic, user: user, title: long_title)
        expect(other_topic.slug.length).to be > TopicLink.max_url_length

        Fabricate(:post, topic: other_topic, user: user, raw: "initial post")
        other_topic_url = "http://#{test_uri.host}/t/#{other_topic.slug}/#{other_topic.id}"

        post_with_link =
          Fabricate(
            :post,
            topic: topic,
            user: user,
            raw: "Link to another topic: #{other_topic_url}",
          )
        TopicLink.extract_from(post_with_link)
        topic.reload
        link = topic.topic_links.first

        expect(link.url.length).to eq(TopicLink.max_url_length)
      end

      it "does not truncate reflection links" do
        SiteSetting.slug_generation_method = "encoded"
        long_title = "Καλημερα σε ολους και ολες" * 9 # 234 chars, but the encoded slug will be 1224 chars in length
        topic = Fabricate(:topic, user: user, title: long_title)
        expect(topic.slug.length).to be > TopicLink.max_url_length
        topic_url = "http://#{test_uri.host}/t/#{topic.slug}/#{topic.id}"

        other_topic = Fabricate(:topic, user: user)
        Fabricate(:post, topic: other_topic, user: user, raw: "initial post")
        other_topic_url = "http://#{test_uri.host}/t/#{other_topic.slug}/#{other_topic.id}"

        post_with_link =
          Fabricate(
            :post,
            topic: topic,
            user: user,
            raw: "Link to another topic: #{other_topic_url}",
          )
        expect { TopicLink.extract_from(post_with_link) }.to_not raise_error

        other_topic.reload
        reflection_link = other_topic.topic_links.first
        expect(reflection_link.url.length).to be > (TopicLink.max_url_length)
        expect(reflection_link.url).to eq(topic_url)
      end
    end

    context "with link to a user on discourse" do
      let(:post) do
        Fabricate(
          :post,
          topic: topic,
          user: user,
          raw: "<a href='/u/#{user.username_lower}'>user</a>",
        )
      end

      before { TopicLink.extract_from(post) }

      it "does not extract a link" do
        expect(topic.topic_links).to be_blank
      end
    end

    context "with link to a discourse resource like a FAQ" do
      let(:post) do
        Fabricate(:post, topic: topic, user: user, raw: "<a href='/faq'>faq link here</a>")
      end

      before { TopicLink.extract_from(post) }

      it "does not extract a link" do
        expect(topic.topic_links).to be_present
      end
    end

    context "with mention links" do
      let(:post) { Fabricate(:post, topic: topic, user: user, raw: "Hey #{user.username_lower}") }

      before { TopicLink.extract_from(post) }

      it "does not extract a link" do
        expect(topic.topic_links).to be_blank
      end
    end

    context "with email address" do
      it "does not extract a link" do
        post =
          Fabricate(
            :post,
            topic: topic,
            user: user,
            raw: "Valid email: foo@bar.com\n\nInvalid email: rfc822;name@domain.com",
          )
        TopicLink.extract_from(post)
        expect(topic.topic_links).to be_blank
      end
    end

    context "with mail link" do
      let(:post) do
        Fabricate(:post, topic: topic, user: user, raw: "[email]bar@example.com[/email]")
      end

      it "does not extract a link" do
        TopicLink.extract_from(post)
        expect(topic.topic_links).to be_blank
      end
    end

    context "with quote links" do
      it "sets quote correctly" do
        linked_post = Fabricate(:post, topic: topic, user: user, raw: "my test post")
        quoting_post =
          Fabricate(
            :post,
            raw:
              "[quote=\"#{user.username}, post: #{linked_post.post_number}, topic: #{topic.id}\"]\nquote\n[/quote]",
          )

        TopicLink.extract_from(quoting_post)
        link = quoting_post.topic.topic_links.first

        expect(link.link_post_id).to eq(linked_post.id)
        expect(link.quote).to eq(true)
      end
    end

    context "with link to a local attachments" do
      let(:post) do
        Fabricate(
          :post,
          topic: topic,
          user: user,
          raw:
            '<a class="attachment" href="/uploads/default/208/87bb3d8428eb4783.rb?foo=bar">ruby.rb</a>',
        )
      end

      it "extracts the link" do
        TopicLink.extract_from(post)
        link = topic.topic_links.first
        # extracted the link
        expect(link).to be_present
        # is set to internal
        expect(link).to be_internal
        # has the correct url
        expect(link.url).to eq("/uploads/default/208/87bb3d8428eb4783.rb?foo=bar")
        # should not be the reflection
        expect(link).not_to be_reflection
        # should have file extension
        expect(link.extension).to eq("rb")
      end
    end

    context "with link to an attachments uploaded on S3" do
      let(:post) do
        Fabricate(
          :post,
          topic: topic,
          user: user,
          raw:
            '<a class="attachment" href="//s3.amazonaws.com/bucket/2104a0211c9ce41ed67989a1ed62e9a394c1fbd1446.rb">ruby.rb</a>',
        )
      end

      it "extracts the link" do
        TopicLink.extract_from(post)
        link = topic.topic_links.first
        # extracted the link
        expect(link).to be_present
        # is not internal
        expect(link).not_to be_internal
        # has the correct url
        expect(link.url).to eq(
          "//s3.amazonaws.com/bucket/2104a0211c9ce41ed67989a1ed62e9a394c1fbd1446.rb",
        )
        # should not be the reflection
        expect(link).not_to be_reflection
        # should have file extension
        expect(link.extension).to eq("rb")
      end
    end
  end

  describe "internal link from pm" do
    it "works" do
      pm = Fabricate(:topic, user: user, category_id: nil, archetype: "private_message")
      Fabricate(:post, topic: pm, user: user, raw: "some content")

      url = "http://#{test_uri.host}/t/topic-slug/#{topic.id}"

      Fabricate(:post, topic: pm, user: user, raw: "initial post")
      linked_post = Fabricate(:post, topic: pm, user: user, raw: "Link to another topic: #{url}")

      TopicLink.extract_from(linked_post)

      expect(topic.topic_links.first).to eq(nil)
      expect(pm.topic_links.first).not_to eq(nil)
    end
  end

  describe "internal link from unlisted topic" do
    it "works" do
      unlisted_topic = Fabricate(:topic, user: user, visible: false)
      url = "http://#{test_uri.host}/t/topic-slug/#{topic.id}"

      Fabricate(:post, topic: unlisted_topic, user: user, raw: "initial post")
      linked_post =
        Fabricate(:post, topic: unlisted_topic, user: user, raw: "Link to another topic: #{url}")

      TopicLink.extract_from(linked_post)

      expect(topic.topic_links.first).to eq(nil)
      expect(unlisted_topic.topic_links.first).not_to eq(nil)
    end
  end

  describe "internal link with non-standard port" do
    it "includes the non standard port if present" do
      other_topic = Fabricate(:topic, user: user)
      SiteSetting.port = 5678
      alternate_uri = URI.parse(Discourse.base_url)

      url = "http://#{alternate_uri.host}:5678/t/topic-slug/#{other_topic.id}"
      post = Fabricate(:post, topic: topic, user: user, raw: "Link to another topic: #{url}")
      TopicLink.extract_from(post)
      reflection = other_topic.topic_links.first

      expect(reflection.url).to eq(
        "http://#{alternate_uri.host}:5678/t/unique-topic-name/#{topic.id}",
      )
    end
  end

  describe "query methods" do
    it "returns blank without posts" do
      expect(TopicLink.counts_for(Guardian.new, nil, nil)).to be_blank
    end

    context "with data" do
      let(:post) do
        topic = Fabricate(:topic, user: Fabricate(:user, refresh_auto_groups: true))
        Fabricate(:post_with_external_links, user: topic.user, topic: topic)
      end

      let(:counts_for) { TopicLink.counts_for(Guardian.new, post.topic, [post]) }

      it "creates a valid topic lookup" do
        TopicLink.extract_from(post)

        lookup = TopicLink.duplicate_lookup(post.topic)
        expect(lookup).to be_present
        expect(lookup["google.com"]).to be_present

        ch = lookup["www.codinghorror.com/blog"]
        expect(ch).to be_present
        expect(ch[:domain]).to eq("www.codinghorror.com")
        expect(ch[:username]).to eq(post.username)
        expect(ch[:posted_at]).to be_present
        expect(ch[:post_number]).to be_present
      end

      it "has the correct results" do
        TopicLink.extract_from(post)
        topic_link_first = post.topic.topic_links.first
        TopicLinkClick.create!(topic_link: topic_link_first, ip_address: "192.168.1.1")
        TopicLinkClick.create!(topic_link: topic_link_first, ip_address: "192.168.1.2")
        topic_link_second = post.topic.topic_links.second
        TopicLinkClick.create!(topic_link: topic_link_second, ip_address: "192.168.1.1")

        expect(counts_for[post.id]).to be_present
        expect(counts_for[post.id].first[:clicks]).to eq(2)
        expect(counts_for[post.id].second[:clicks]).to eq(1)

        array = TopicLink.topic_map(Guardian.new, post.topic_id)
        expect(array.length).to eq(2)
        expect(array[0].clicks).to eq(2)
        expect(array[1].clicks).to eq(1)
      end

      it "secures internal links correctly" do
        category = Fabricate(:category)
        secret_topic = Fabricate(:topic, category: category)

        url = "http://#{test_uri.host}/t/topic-slug/#{secret_topic.id}"
        post = Fabricate(:post, raw: "hello test topic #{url}")
        TopicLink.extract_from(post)
        TopicLinkClick.create!(topic_link: post.topic.topic_links.first, ip_address: "192.168.1.1")

        expect(TopicLink.topic_map(Guardian.new, post.topic_id).count).to eq(1)
        expect(TopicLink.counts_for(Guardian.new, post.topic, [post]).length).to eq(1)

        category.set_permissions(staff: :full)
        category.save

        admin = Fabricate(:admin)

        expect(TopicLink.topic_map(Guardian.new, post.topic_id).count).to eq(0)
        expect(TopicLink.topic_map(Guardian.new(admin), post.topic_id).count).to eq(1)

        expect(TopicLink.counts_for(Guardian.new, post.topic, [post]).length).to eq(0)
        expect(TopicLink.counts_for(Guardian.new(admin), post.topic, [post]).length).to eq(1)
      end

      it "does not include links from whisper" do
        url = "https://blog.codinghorror.com/hacker-hack-thyself/"
        post = Fabricate(:post, raw: "whisper post... #{url}", post_type: Post.types[:whisper])
        TopicLink.extract_from(post)

        expect(TopicLink.topic_map(Guardian.new, post.topic_id).count).to eq(0)
      end

      it "secures internal links correctly" do
        other_topic = Fabricate(:topic)
        other_user = Fabricate(:user)

        url = "http://#{test_uri.host}/t/topic-slug/#{other_topic.id}"
        post = Fabricate(:post, raw: "hello test topic #{url}")
        TopicLink.extract_from(post)
        TopicLinkClick.create!(topic_link: post.topic.topic_links.first, ip_address: "192.168.1.1")

        expect(TopicLink.counts_for(Guardian.new(other_user), post.topic, [post]).length).to eq(1)

        TopicUser.change(
          other_user.id,
          other_topic.id,
          notification_level: TopicUser.notification_levels[:muted],
        )

        expect(TopicLink.counts_for(Guardian.new(other_user), post.topic, [post]).length).to eq(0)
      end
    end

    describe ".duplicate_lookup" do
      fab!(:user) { Fabricate(:user, username: "junkrat", refresh_auto_groups: true) }

      let(:post_with_internal_link) do
        Fabricate(:post, user: user, raw: "Check out this topic #{post.topic.url}/122131")
      end

      it "should return the right response" do
        TopicLink.extract_from(post_with_internal_link)

        result = TopicLink.duplicate_lookup(post_with_internal_link.topic)
        expect(result.count).to eq(1)

        lookup = result["test.localhost/t/#{post.topic.slug}/#{post.topic.id}/122131"]

        expect(lookup[:domain]).to eq("test.localhost")
        expect(lookup[:username]).to eq("junkrat")
        expect(lookup[:posted_at].to_s).to eq(post_with_internal_link.created_at.to_s)
        expect(lookup[:post_number]).to eq(1)

        result = TopicLink.duplicate_lookup(post.topic)
        expect(result).to eq({})
      end
    end

    it "works with invalid link target" do
      post =
        Fabricate(
          :post,
          raw: '<a href="http:geturl">http:geturl</a>',
          user: user,
          topic: topic,
          cook_method: Post.cook_methods[:raw_html],
        )
      expect { TopicLink.extract_from(post) }.to_not raise_error
    end
  end
end
