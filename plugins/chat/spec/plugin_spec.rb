# frozen_string_literal: true

describe Chat do
  before do
    SiteSetting.clean_up_uploads = true
    SiteSetting.clean_orphan_uploads_grace_period_hours = 1
    Jobs::CleanUpUploads.new.reset_last_cleanup!
    SiteSetting.chat_enabled = true
  end

  describe "register_upload_unused" do
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:category)) }
    fab!(:user)
    fab!(:upload) { Fabricate(:upload, user: user, created_at: 1.month.ago) }
    fab!(:unused_upload) { Fabricate(:upload, user: user, created_at: 1.month.ago) }

    let!(:chat_message) do
      Fabricate(
        :chat_message,
        chat_channel: chat_channel,
        user: user,
        message: "Hello world!",
        uploads: [upload],
      )
    end

    it "marks uploads with reference to ChatMessage via UploadReference in use" do
      unused_upload

      expect { Jobs::CleanUpUploads.new.execute({}) }.to change { Upload.count }.by(-1)
      expect(Upload.exists?(id: upload.id)).to eq(true)
      expect(Upload.exists?(id: unused_upload.id)).to eq(false)
    end
  end

  describe "register_upload_in_use" do
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:category)) }
    fab!(:user)
    fab!(:message_upload) { Fabricate(:upload, user: user, created_at: 1.month.ago) }
    fab!(:draft_upload) { Fabricate(:upload, user: user, created_at: 1.month.ago) }
    fab!(:unused_upload) { Fabricate(:upload, user: user, created_at: 1.month.ago) }

    let!(:chat_message) do
      Fabricate(
        :chat_message,
        chat_channel: chat_channel,
        user: user,
        message: "Hello world! #{message_upload.sha1}",
      )
    end
    let!(:draft_message) do
      Chat::Draft.create!(
        user: user,
        chat_channel: chat_channel,
        data:
          "{\"value\":\"hello world \",\"uploads\":[\"#{draft_upload.sha1}\"],\"replyToMsg\":null}",
      )
    end

    it "marks uploads with reference to ChatMessage via UploadReference in use" do
      draft_upload
      unused_upload

      expect { Jobs::CleanUpUploads.new.execute({}) }.to change { Upload.count }.by(-1)
      expect(Upload.exists?(id: message_upload.id)).to eq(true)
      expect(Upload.exists?(id: draft_upload.id)).to eq(true)
      expect(Upload.exists?(id: unused_upload.id)).to eq(false)
    end
  end

  describe "user card serializer extension #can_chat_user" do
    fab!(:target_user) { Fabricate(:user) }
    let!(:user) { Fabricate(:user) }
    let!(:guardian) { Guardian.new(user) }
    let(:serializer) { UserCardSerializer.new(target_user, scope: guardian) }
    fab!(:group)

    context "when chat enabled" do
      before { SiteSetting.chat_enabled = true }

      it "returns true if the target user and the guardian user is in the Chat.allowed_group_ids" do
        SiteSetting.chat_allowed_groups = group.id
        SiteSetting.direct_message_enabled_groups = group.id
        GroupUser.create(user: target_user, group: group)
        GroupUser.create(user: user, group: group)
        expect(serializer.can_chat_user).to eq(true)
      end

      it "returns false if the target user but not the guardian user is in the Chat.allowed_group_ids" do
        SiteSetting.chat_allowed_groups = group.id
        GroupUser.create(user: target_user, group: group)
        expect(serializer.can_chat_user).to eq(false)
      end

      it "returns false if the guardian user but not the target user is in the Chat.allowed_group_ids" do
        SiteSetting.chat_allowed_groups = group.id
        GroupUser.create(user: user, group: group)
        expect(serializer.can_chat_user).to eq(false)
      end

      context "when guardian user is same as target user" do
        let!(:guardian) { Guardian.new(target_user) }

        it "returns false" do
          expect(serializer.can_chat_user).to eq(false)
        end
      end

      context "when guardian user is anon" do
        let!(:guardian) { Guardian.new }

        it "returns false" do
          expect(serializer.can_chat_user).to eq(false)
        end
      end

      context "when both users are in Chat.allowed_group_ids" do
        before do
          SiteSetting.chat_allowed_groups = group.id
          SiteSetting.direct_message_enabled_groups = group.id
          GroupUser.create(user: target_user, group: group)
          GroupUser.create(user: user, group: group)
        end

        it "returns true when both users are valid" do
          expect(serializer.can_chat_user).to eq(true)
        end

        it "returns false if current user has chat disabled" do
          user.user_option.update!(chat_enabled: false)
          expect(serializer.can_chat_user).to eq(false)
        end

        it "returns false if target user has chat disabled" do
          target_user.user_option.update!(chat_enabled: false)
          expect(serializer.can_chat_user).to eq(false)
        end

        it "returns false if user is not in dm allowed group" do
          SiteSetting.direct_message_enabled_groups = 3
          expect(serializer.can_chat_user).to eq(false)
        end
      end
    end

    context "when chat not enabled" do
      before { SiteSetting.chat_enabled = false }

      it "returns false" do
        expect(serializer.can_chat_user).to eq(false)
      end
    end
  end

  describe "admin plugin serializer extension" do
    let(:admin) { Fabricate(:admin) }
    let(:chat_plugin) do
      Plugin::Instance.parse_from_source(File.join(Rails.root, "plugins", "chat", "plugin.rb"))
    end
    let(:serializer) { AdminPluginSerializer.new(chat_plugin, scope: admin.guardian) }

    it "includes all incoming webhooks via :incoming_chat_webhooks" do
      webhook = Fabricate(:incoming_chat_webhook)
      expect(serializer.incoming_chat_webhooks).to contain_exactly(webhook)
    end

    it "includes all chat channels via :chat_channels" do
      channel = Fabricate(:chat_channel)
      expect(serializer.chat_channels).to contain_exactly(channel)
    end
  end

  describe "chat oneboxes" do
    fab!(:chat_channel) { Fabricate(:category_channel) }
    fab!(:user)

    fab!(:chat_message) do
      Fabricate(:chat_message, chat_channel: chat_channel, user: user, message: "Hello world!")
    end

    let(:chat_url) { "#{Discourse.base_url}/chat/c/-/#{chat_channel.id}" }

    context "when inline" do
      it "renders channel" do
        results = InlineOneboxer.new([chat_url], skip_cache: true).process
        expect(results).to be_present
        expect(results[0][:url]).to eq(chat_url)
        expect(results[0][:title]).to eq("Chat ##{chat_channel.name}")
      end

      it "renders messages" do
        results = InlineOneboxer.new(["#{chat_url}/#{chat_message.id}"], skip_cache: true).process
        expect(results).to be_present
        expect(results[0][:url]).to eq("#{chat_url}/#{chat_message.id}")
        expect(results[0][:title]).to eq(
          "Message ##{chat_message.id} by #{chat_message.user.username} – ##{chat_channel.name}",
        )
      end
    end
  end

  describe "auto-joining users to a channel" do
    fab!(:chatters_group) { Fabricate(:group) }
    fab!(:user) { Fabricate(:user, last_seen_at: 15.minutes.ago) }
    let!(:channel) { Fabricate(:category_channel, auto_join_users: true, chatable: category) }

    before { Jobs.run_immediately! }

    def assert_user_following_state(user, channel, following:)
      membership = Chat::UserChatChannelMembership.find_by(user: user, chat_channel: channel)

      following ? (expect(membership.following).to eq(true)) : (expect(membership).to be_nil)
    end

    describe "when a user is added to a group with access to a channel through a category" do
      let!(:category) { Fabricate(:private_category, group: chatters_group) }

      it "joins the user to the channel if auto-join is enabled" do
        chatters_group.add(user)

        assert_user_following_state(user, channel, following: true)
      end

      it "does nothing if auto-join is disabled" do
        channel.update!(auto_join_users: false)

        assert_user_following_state(user, channel, following: false)
      end
    end

    describe "when a user is created" do
      fab!(:category)
      let(:user) { Fabricate(:user, last_seen_at: nil, first_seen_at: nil) }

      it "queues a job to auto-join the user the first time they log in" do
        user.update_last_seen!

        assert_user_following_state(user, channel, following: true)
      end

      it "does nothing if it's not the first time we see the user" do
        user.update!(first_seen_at: 2.minute.ago)
        user.update_last_seen!

        assert_user_following_state(user, channel, following: false)
      end

      it "does nothing if auto-join is disabled" do
        channel.update!(auto_join_users: false)

        user.update_last_seen!

        assert_user_following_state(user, channel, following: false)
      end
    end

    describe "when category permissions change" do
      fab!(:category)

      let(:chatters_group_permission) do
        { chatters_group.name => CategoryGroup.permission_types[:full] }
      end

      describe "given permissions to a new group" do
        it "adds the user to the channel" do
          chatters_group.add(user)

          category.update!(permissions: chatters_group_permission)

          assert_user_following_state(user, channel, following: true)
        end

        it "does nothing if there is no channel for the category" do
          another_category = Fabricate(:category)

          another_category.update!(permissions: chatters_group_permission)

          assert_user_following_state(user, channel, following: false)
        end
      end
    end
  end

  describe "secure uploads compatibility" do
    it "disables chat uploads if secure uploads changes from disabled to enabled" do
      enable_secure_uploads
      expect(SiteSetting.chat_allow_uploads).to eq(false)
      last_history = UserHistory.last
      expect(last_history.action).to eq(UserHistory.actions[:change_site_setting])
      expect(last_history.previous_value).to eq("true")
      expect(last_history.new_value).to eq("false")
      expect(last_history.subject).to eq("chat_allow_uploads")
      expect(last_history.context).to eq("Disabled because secure_uploads is enabled")
    end

    it "does not disable chat uploads if the allow_unsecure_chat_uploads global setting is set" do
      global_setting :allow_unsecure_chat_uploads, true
      expect { enable_secure_uploads }.not_to change { UserHistory.count }
      expect(SiteSetting.chat_allow_uploads).to eq(true)
    end
  end

  describe "current_user_serializer#has_joinable_public_channels" do
    before do
      SiteSetting.chat_enabled = true
      SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
    end

    fab!(:user)
    let(:serializer) { CurrentUserSerializer.new(user, scope: Guardian.new(user)) }

    context "when no channels exist" do
      it "returns false" do
        expect(serializer.has_joinable_public_channels).to eq(false)
      end
    end

    context "when no joinable channel exist" do
      fab!(:channel) { Fabricate(:chat_channel) }

      before do
        Fabricate(:user_chat_channel_membership, user: user, chat_channel: channel, following: true)
      end

      it "returns false" do
        expect(serializer.has_joinable_public_channels).to eq(false)
      end
    end

    context "when no public channel exist" do
      fab!(:private_category) { Fabricate(:private_category, group: Fabricate(:group)) }
      fab!(:private_channel) { Fabricate(:chat_channel, chatable: private_category) }

      it "returns false" do
        expect(serializer.has_joinable_public_channels).to eq(false)
      end
    end

    context "when a joinable channel exists" do
      fab!(:channel) { Fabricate(:chat_channel) }

      it "returns true" do
        expect(serializer.has_joinable_public_channels).to eq(true)
      end
    end
  end

  describe "Deleting posts while deleting a user" do
    fab!(:user)

    it "queues a job to also delete chat messages" do
      deletion_opts = { delete_posts: true }

      expect { UserDestroyer.new(Discourse.system_user).destroy(user, deletion_opts) }.to change(
        Jobs::Chat::DeleteUserMessages.jobs,
        :size,
      ).by(1)
    end
  end
end
