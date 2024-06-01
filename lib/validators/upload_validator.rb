# frozen_string_literal: true

require "file_helper"

class UploadValidator < ActiveModel::Validator
  def validate(upload)
    # staff can upload any file in PM
    if (upload.for_private_message && SiteSetting.allow_staff_to_upload_any_file_in_pm)
      return true if upload.user&.staff?
    end

    # check the attachment blocklist
    if upload.for_group_message && SiteSetting.allow_all_attachments_for_group_messages
      return upload.original_filename =~ SiteSetting.blocked_attachment_filenames_regex
    end

    extension = File.extname(upload.original_filename)[1..-1] || ""

    if upload.for_site_setting && upload.user&.staff? &&
         FileHelper.is_supported_image?(upload.original_filename)
      return true
    end

    if upload.for_gravatar && FileHelper.supported_gravatar_extensions.include?(extension)
      maximum_image_file_size(upload)
      return true
    end

    return true if changing_upload_security?(upload)

    if is_authorized?(upload, extension)
      if FileHelper.is_supported_image?(upload.original_filename)
        authorized_image_extension(upload, extension)
        maximum_image_file_size(upload)
      else
        authorized_attachment_extension(upload, extension)
        maximum_attachment_file_size(upload)
      end
    end
  end

  # this should only be run on existing records, and covers cases of
  # upload.update_secure_status being run outside of the creation flow,
  # where some cases e.g. have exemptions on the extension enforcement
  def changing_upload_security?(upload)
    !upload.new_record? &&
      upload.changed_attributes.keys.all? do |attribute|
        %w[secure security_last_changed_at security_last_changed_reason].include?(attribute)
      end
  end

  def is_authorized?(upload, extension)
    extension_authorized?(upload, extension, authorized_extensions(upload))
  end

  def authorized_image_extension(upload, extension)
    extension_authorized?(upload, extension, authorized_images(upload))
  end

  def maximum_image_file_size(upload)
    maximum_file_size(upload, "image")
  end

  def authorized_attachment_extension(upload, extension)
    extension_authorized?(upload, extension, authorized_attachments(upload))
  end

  def maximum_attachment_file_size(upload)
    maximum_file_size(upload, "attachment")
  end

  private

  def extensions_to_set(exts)
    extensions = Set.new

    exts
      .gsub(/[\s\.]+/, "")
      .downcase
      .split("|")
      .each { |extension| extensions << extension if extension.exclude?("*") }

    extensions
  end

  def authorized_extensions(upload)
    extensions =
      if upload.for_theme
        SiteSetting.theme_authorized_extensions
      elsif upload.for_export
        SiteSetting.export_authorized_extensions
      else
        SiteSetting.authorized_extensions
      end
    extensions_to_set(extensions)
  end

  def authorized_images(upload)
    authorized_extensions(upload) & FileHelper.supported_images
  end

  def authorized_attachments(upload)
    authorized_extensions(upload) - FileHelper.supported_images
  end

  def authorizes_all_extensions?(upload)
    if upload.user&.staff?
      return true if SiteSetting.authorized_extensions_for_staff.include?("*")
    end
    extensions =
      if upload.for_theme
        SiteSetting.theme_authorized_extensions
      elsif upload.for_export
        SiteSetting.export_authorized_extensions
      else
        SiteSetting.authorized_extensions
      end
    extensions.include?("*")
  end

  def extension_authorized?(upload, extension, extensions)
    return true if authorizes_all_extensions?(upload)

    staff_extensions = Set.new
    if upload.user&.staff?
      staff_extensions = extensions_to_set(SiteSetting.authorized_extensions_for_staff)
      return true if staff_extensions.include?(extension.downcase)
    end

    unless authorized = extensions.include?(extension.downcase)
      message =
        I18n.t(
          "upload.unauthorized",
          authorized_extensions: (extensions | staff_extensions).to_a.join(", "),
        )
      upload.errors.add(:original_filename, message)
    end

    authorized
  end

  def maximum_file_size(upload, type)
    return if !upload.validate_file_size

    max_size_kb =
      if upload.for_export
        SiteSetting.max_export_file_size_kb
      else
        SiteSetting.get("max_#{type}_size_kb")
      end

    max_size_bytes = max_size_kb.kilobytes

    if upload.filesize > max_size_bytes
      message =
        I18n.t(
          "upload.#{type}s.too_large_humanized",
          max_size: ActiveSupport::NumberHelper.number_to_human_size(max_size_bytes),
        )
      upload.errors.add(:filesize, message)
    end
  end
end
