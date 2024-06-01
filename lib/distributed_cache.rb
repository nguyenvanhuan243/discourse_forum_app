# frozen_string_literal: true

require "message_bus/distributed_cache"

class DistributedCache < MessageBus::DistributedCache
  def initialize(key, manager: nil, namespace: true)
    super(key, manager: manager, namespace: namespace, app_version: Discourse.git_version)
  end

  # Defer setting of the key in the cache for performance critical path to avoid
  # waiting on MessageBus to publish the message which involves writing to Redis.
  def defer_set(k, v)
    Scheduler::Defer.later("#{@key}_set") { self[k] = v }
  end

  def defer_get_set(k, &block)
    raise TypeError if !Rails.env.production? && !k.is_a?(String)

    return self[k] if hash.key? k
    value = block.call
    self.defer_set(k, value)
    value
  end

  def defer_get_set_bulk(ks, key_blk, &blk)
    found_keys, missing_keys = ks.partition { |k| hash.key?(key_blk.call(k)) }
    found_hash = found_keys.map { |key| [key, self[key_blk.call(key)]] }.to_h

    if missing_keys.present?
      missing_values = blk.call(missing_keys.freeze)
      missing_hash = missing_keys.zip(missing_values).to_h

      Scheduler::Defer.later("#{@key}_bulk_set") do
        missing_hash.each { |key, value| self[key_blk.call(key)] = value }
      end

      ks.zip(missing_hash.merge(found_hash).values_at(*ks)).to_h
    else
      found_hash
    end
  end

  def clear(after_commit: true)
    if after_commit && !GlobalSetting.skip_db?
      DB.after_commit { super() }
    else
      super()
    end
  end

  def clear_regex(regex)
    hash.keys.select { |k| k =~ regex }.each { |k| delete(k) }
  end
end
