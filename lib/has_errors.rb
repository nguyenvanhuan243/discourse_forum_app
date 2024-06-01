# frozen_string_literal: true

# Helper functions for dealing with errors and objects that have
# child objects with errors
module HasErrors
  attr_accessor :forbidden, :not_found, :conflict

  def errors
    @errors ||= ActiveModel::Errors.new(self)
  end

  def validate_child(obj)
    return true if obj.valid?
    add_errors_from(obj)
    false
  end

  def rollback_with!(obj, error)
    obj.errors.add(:base, error)
    rollback_from_errors!(obj)
  end

  def rollback_from_errors!(obj)
    add_errors_from(obj)
    raise ActiveRecord::Rollback.new
  end

  def add_error(msg)
    errors.add(:base, msg) if errors[:base].exclude?(msg)
  end

  def add_errors_from(obj)
    return if obj.blank?

    return add_error(obj.message) if obj.is_a?(StandardError)

    obj.errors.full_messages.each { |msg| add_error(msg) }
  end
end
