# frozen_string_literal: true

class UploadSerializer < ApplicationSerializer
  attributes :id,
             :url,
             :original_filename,
             :filesize,
             :width,
             :height,
             :thumbnail_width,
             :thumbnail_height,
             :extension,
             :short_url,
             :short_path,
             :retain_hours,
             :human_filesize,
             :dominant_color

  def url
    if object.for_site_setting
      object.url
    else
      UrlHelper.cook_url(object.url, secure: SiteSetting.secure_uploads? && object.secure)
    end
  end
end
