# frozen_string_literal: true

class CategorySetting < ActiveRecord::Base
  belongs_to :category

  validates :num_auto_bump_daily,
            numericality: {
              only_integer: true,
              greater_than_or_equal_to: 0,
              allow_nil: true,
            }

  validates :auto_bump_cooldown_days,
            numericality: {
              only_integer: true,
              greater_than_or_equal_to: 0,
              allow_nil: true,
            }
end

# == Schema Information
#
# Table name: category_settings
#
#  id                      :bigint           not null, primary key
#  category_id             :bigint           not null
#  require_topic_approval  :boolean          default(FALSE)
#  require_reply_approval  :boolean          default(FALSE)
#  num_auto_bump_daily     :integer          default(0)
#  created_at              :datetime         not null
#  updated_at              :datetime         not null
#  auto_bump_cooldown_days :integer          default(1)
# Indexes
#
#  index_category_settings_on_category_id  (category_id) UNIQUE
#
