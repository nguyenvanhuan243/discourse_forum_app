# frozen_string_literal: true

module Jobs
  class BulkInvite < ::Jobs::Base
    sidekiq_options retry: false

    def initialize
      super

      @logs = []
      @sent = 0
      @skipped = 0
      @skipped_emails = []
      @warnings = 0
      @failed = 0
      @failed_emails = []
      @groups = {}
      @user_fields = {}
      @valid_groups = {}
    end

    def execute(args)
      @invites = args[:invites]
      raise Discourse::InvalidParameters.new(:invites) if @invites.blank?

      @current_user = User.find_by(id: args[:current_user_id])
      raise Discourse::InvalidParameters.new(:current_user_id) unless @current_user

      @skip_email = SiteSetting.skip_email_bulk_invites

      @guardian = Guardian.new(@current_user)

      process_invites(@invites)

      if @invites.length > Invite::BULK_INVITE_EMAIL_LIMIT
        ::Jobs.enqueue(:process_bulk_invite_emails)
      end
    ensure
      notify_user
    end

    private

    def process_invites(invites)
      invites.each do |invite|
        if EmailAddressValidator.valid_value?(invite[:email])
          # email is valid
          result = send_invite(invite)
          if Invite === result
            @sent += 1
          elsif User === result
            @skipped += 1
            @skipped_emails << invite[:email]
          else
            @failed += 1
            @failed_emails << invite[:email]
          end
        else
          # invalid email
          save_log "Invalid Email '#{invite[:email]}"
          @failed += 1
          @failed_emails << invite[:email]
        end
      end
    rescue Exception => e
      save_log "Bulk Invite Process Failed -- '#{e.message}'"
      @failed += 1
      @failed_emails << invite[:email]
    end

    def get_groups(group_names, email)
      groups = []

      if group_names
        group_names = group_names.split(";")

        group_names.each do |group_name|
          group = fetch_group(group_name)

          if group && can_edit_group?(group)
            # valid group
            groups.push(group)
          else
            # invalid group
            save_log "Invalid Group '#{group_name}' for '#{email}'"
            @warnings += 1
          end
        end
      end

      groups
    end

    def get_topic(topic_id, email)
      topic = nil

      if topic_id
        topic = Topic.find_by_id(topic_id)
        if topic.nil?
          save_log "Invalid Topic ID '#{topic_id}' for '#{email}'"
          @warnings += 1
        end
      end

      topic
    end

    def get_user_fields(fields, email)
      user_fields = {}

      fields.each do |key, value|
        @user_fields[key] ||= UserField
          .includes(:user_field_options)
          .where("name ILIKE ?", key)
          .first || :nil
        if @user_fields[key] == :nil
          save_log "Invalid User Field '#{key}' for '#{email}'"
          @warnings += 1
          next
        end

        # Automatically correct user field value
        if @user_fields[key].field_type == "dropdown"
          value =
            @user_fields[key].user_field_options.find { |ufo| ufo.value.casecmp?(value) }&.value
        end

        user_fields[@user_fields[key].id] = value
      end

      user_fields
    end

    def send_invite(invite)
      email = invite[:email]
      groups = get_groups(invite[:groups], email)
      topic = get_topic(invite[:topic_id], email)
      locale = invite[:locale]
      user_fields = get_user_fields(invite.except(:email, :groups, :topic_id, :locale), email)

      begin
        if user = Invite.find_user_by_email(email)
          if groups.present?
            Group.transaction do
              groups.each do |group|
                group.add(user)

                GroupActionLogger.new(@current_user, group).log_add_user_to_group(user)
              end
            end
          end

          if user_fields.present?
            user_fields.each { |user_field, value| user.set_user_field(user_field, value) }
            user.save_custom_fields
          end

          if locale.present?
            user.locale = locale
            user.save!
          end

          user
        else
          if user_fields.present? || locale.present?
            user = User.where(staged: true).find_by_email(email)
            user ||=
              User.new(username: UserNameSuggester.suggest(email), email: email, staged: true)

            if user_fields.present?
              user_fields.each { |user_field, value| user.set_user_field(user_field, value) }
            end

            user.locale = locale if locale.present?

            user.save!
          end

          invite_opts = {
            email: email,
            topic: topic,
            group_ids: groups.map(&:id),
            skip_email: @skip_email,
          }

          if @invites.length > Invite::BULK_INVITE_EMAIL_LIMIT
            invite_opts[:emailed_status] = Invite.emailed_status_types[:bulk_pending]
          end

          Invite.generate(@current_user, invite_opts)
        end
      rescue => e
        save_log "Error inviting '#{email}' -- #{Rails::Html::FullSanitizer.new.sanitize(e.message)}"

        nil
      end
    end

    def save_log(message)
      @logs << "[#{Time.now}] #{message}"
    end

    def notify_user
      if @current_user
        if @sent > 0 && @failed == 0
          SystemMessage.create_from_system_user(
            @current_user,
            :bulk_invite_succeeded,
            sent: @sent,
            skipped: @skipped,
            skipped_emails: @skipped_emails.join("\n"),
            warnings: @warnings,
            logs: @logs.join("\n"),
          )
        else
          SystemMessage.create_from_system_user(
            @current_user,
            :bulk_invite_failed,
            sent: @sent,
            skipped: @skipped,
            skipped_emails: @skipped_emails.join("\n"),
            warnings: @warnings,
            failed: @failed,
            failed_emails: @failed_emails.join("\n"),
            logs: @logs.join("\n"),
          )
        end
      end
    end

    def fetch_group(group_name)
      group_name = group_name.downcase
      group = @groups[group_name]

      unless group
        group = Group.find_by("lower(name) = ?", group_name)
        @groups[group_name] = group
      end

      group
    end

    def can_edit_group?(group)
      group_name = group.name.downcase
      result = @valid_groups[group_name]

      unless result
        result = @guardian.can_edit_group?(group)
        @valid_groups[group_name] = result
      end

      result
    end
  end
end
