# frozen_string_literal: true

Fabricator(:post) do
  user { Fabricate(:user, refresh_auto_groups: true) }
  topic { |attrs| Fabricate(:topic, user: attrs[:user]) }
  raw "Hello world"
  post_type Post.types[:regular]

  # Fabrication bypasses PostCreator, for performance reasons, where the counts are updated so we have to handle this manually here.
  after_create { |post, _transients| UserStatCountUpdater.increment!(post) }
end

Fabricator(:post_with_long_raw_content, from: :post) do
  raw "This is a sample post with semi-long raw content. The raw content is also more than
      two hundred characters to satisfy any test conditions that require content longer
      than the typical test post raw content. It really is some long content, folks."
end

Fabricator(:post_with_very_long_raw_content, from: :post) do
  raw "This is a sample post with very long raw content. The raw content is actually so long
      that there is no way it could be longer. It is adding so many characters to the post content
      so that we can use it in testing for scenarios where a post is very long and might cause issues.
      The post is so long in fact, that the text is split into various paragraphs. Some people are not
      very concise in their words. They tend to ramble and ramble on about certain information. This
      is why we need to make sure that we are going about testing in certain ways so that when people
      such as those that ramble on, are making posts, we can be sure that the posts are not causing
      any issues. When issues happen it can cause lots of problems. For example, if a post is too long,
      it affects the way it can be viewed by others.
      Depending on the screen size, it may cause a lot of scrolling to take place. This is not good.
      In certain cases, we want to truncate the content of the post when its too long so that it does
      not cause issues. This is why we need to make sure that we are testing for these scenarios. I think
      this post has gotten very long, however, I would like to make sure that it is a bit longer, so I
      will add one final sentence. This is my final sentence, thank you for reading, goodbye."
end

Fabricator(:post_with_youtube, from: :post) do
  raw "http://www.youtube.com/watch?v=9bZkp7q19f0"
  cooked '<p><a href="http://www.youtube.com/watch?v=9bZkp7q19f0" class="onebox" target="_blank">http://www.youtube.com/watch?v=9bZkp7q19f0</a></p>'
end

Fabricator(:old_post, from: :post) do
  topic { |attrs| Fabricate(:topic, user: attrs[:user], created_at: (DateTime.now - 100)) }
  created_at { 100.days.ago }
end

Fabricator(:moderator_post, from: :post) do
  user
  topic { |attrs| Fabricate(:topic, user: attrs[:user]) }
  post_type Post.types[:moderator_action]
  raw "Hello world"
end

Fabricator(:basic_reply, from: :post) do
  user(fabricator: :coding_horror)
  reply_to_post_number 1
  topic
  raw "this reply has no quotes"
end

Fabricator(:reply, from: :post) do
  user(fabricator: :coding_horror)
  topic
  raw '
    [quote="Evil Trout, post:1"]hello[/quote]
    Hmmm!
  '
end

Fabricator(:post_with_plenty_of_images, from: :post) { cooked <<~HTML }
<aside class="quote"><img src="/#{Discourse.store.upload_path}/original/1X/1234567890123456.jpg"></aside>
<div class="onebox-result"><img src="/#{Discourse.store.upload_path}/original/1X/1234567890123456.jpg"></div>
<div class="onebox"><img src="/#{Discourse.store.upload_path}/original/1X/1234567890123456.jpg"></div>
<p>With an emoji! <img src="//cdn.discourse.org/meta/images/emoji/twitter/smile.png?v=#{Emoji::EMOJI_VERSION}" title=":smile:" class="emoji" alt="smile" loading="lazy" width="20" height="20"></p>
HTML

Fabricator(:post_with_uploaded_image, from: :post) do
  raw { "<img src=\"#{Fabricate(:image_upload)}\" width=\"1500\" height=\"2000\">" }
end

Fabricator(:post_with_an_attachment, from: :post) do
  raw "<a class=\"attachment\" href=\"/#{Discourse.store.upload_path}/original/1X/66b3ed1503efc936.zip\">archive.zip</a>"
end

Fabricator(:post_with_unsized_images, from: :post) do
  raw "
<img src=\"http://foo.bar/image.png\">
<img src=\"/#{Discourse.store.upload_path}/original/1X/1234567890123456.jpg\">
"
end

Fabricator(:post_with_image_urls, from: :post) do
  raw '
<img src="http://foo.bar/image.png">
<img src="http://domain.com/picture.jpg" width="50" height="42">
'
end

Fabricator(:post_with_large_image, from: :post) do
  raw "<img src=\"/#{Discourse.store.upload_path}/original/1X/1234567890123456.jpg\">"
end

Fabricator(:post_with_large_image_and_title, from: :post) do
  raw "<img src=\"/#{Discourse.store.upload_path}/original/1X/1234567890123456.jpg\" title=\"WAT\">"
end

Fabricator(:post_with_large_image_on_subfolder, from: :post) do
  raw "<img src=\"/subfolder/#{Discourse.store.upload_path}/original/1X/1234567890123456.jpg\">"
end

Fabricator(:post_with_uploads, from: :post) do
  raw "
<a href=\"/#{Discourse.store.upload_path}/original/2X/2345678901234567.jpg\">Link</a>
<img src=\"/#{Discourse.store.upload_path}/original/1X/1234567890123456.jpg\">
"
end

Fabricator(:post_with_uploads_and_links, from: :post) { raw <<~MD }
    <a href="/#{Discourse.store.upload_path}/original/2X/2345678901234567.jpg">Link</a>
    <img src="/#{Discourse.store.upload_path}/original/1X/1234567890123456.jpg">
    <a href="http://www.google.com">Google</a>
    <img src="http://foo.bar/image.png">
    <a class="attachment" href="/#{Discourse.store.upload_path}/original/1X/af2c2618032c679333bebf745e75f9088748d737.txt">text.txt</a> (20 Bytes)
    :smile:
  MD

Fabricator(:post_with_external_links, from: :post) do
  user { Fabricate(:user, refresh_auto_groups: true) }
  topic
  raw <<~MD
    Here's a link to twitter: http://twitter.com
    And a link to google: http://google.com
    And a secure link to google: https://google.com
    And a markdown link: [forumwarz](http://forumwarz.com)
    And a markdown link with a period after it [codinghorror](http://www.codinghorror.com/blog).
    And one with a hash http://discourse.org#faq
    And one with a two hash http://discourse.org#a#b
  MD
end

Fabricator(:private_message_post, from: :post) do
  transient :recipient
  user
  topic do |attrs|
    Fabricate(
      :private_message_topic,
      user: attrs[:user],
      created_at: attrs[:created_at],
      subtype: TopicSubtype.user_to_user,
      topic_allowed_users: [
        Fabricate.build(:topic_allowed_user, user: attrs[:user]),
        Fabricate.build(:topic_allowed_user, user: attrs[:recipient] || Fabricate(:user)),
      ],
    )
  end
  raw "Ssshh! This is our secret conversation!"
end

Fabricator(:group_private_message_post, from: :post) do
  transient :recipients
  user
  topic do |attrs|
    Fabricate(
      :private_message_topic,
      user: attrs[:user],
      created_at: attrs[:created_at],
      subtype: TopicSubtype.user_to_user,
      topic_allowed_users: [Fabricate.build(:topic_allowed_user, user: attrs[:user])],
      topic_allowed_groups: [
        Fabricate.build(:topic_allowed_group, group: attrs[:recipients] || Fabricate(:group)),
      ],
    )
  end
  raw "Ssshh! This is our group secret conversation!"
end

Fabricator(:private_message_post_one_user, from: :post) do
  user
  topic do |attrs|
    Fabricate(
      :private_message_topic,
      user: attrs[:user],
      created_at: attrs[:created_at],
      subtype: TopicSubtype.user_to_user,
      topic_allowed_users: [Fabricate.build(:topic_allowed_user, user: attrs[:user])],
    )
  end
  raw "Ssshh! This is our secret conversation!"
end

Fabricator(:post_via_email, from: :post) do
  incoming_email
  via_email true

  after_create do |post|
    incoming_email.topic = post.topic
    incoming_email.post = post
    incoming_email.user = post.user
  end
end

Fabricator(:whisper, from: :post) { post_type Post.types[:whisper] }

Fabricator(:small_action, from: :post) { post_type Post.types[:small_action] }
