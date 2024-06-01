# frozen_string_literal: true

module BackupRestore
  # @abstract
  class BackupStore
    BackupFileExists = Class.new(RuntimeError)
    StorageError = Class.new(RuntimeError)

    # @return [BackupStore]
    def self.create(opts = {})
      case opts[:location] || SiteSetting.backup_location
      when BackupLocationSiteSetting::LOCAL
        require "backup_restore/local_backup_store"
        BackupRestore::LocalBackupStore.new(opts)
      when BackupLocationSiteSetting::S3
        require "backup_restore/s3_backup_store"
        BackupRestore::S3BackupStore.new(opts)
      end
    end

    # @return [Array<BackupFile>]
    def files
      @files ||= unsorted_files.sort_by { |file| -file.last_modified.to_i }
    end

    # @return [BackupFile]
    def latest_file
      files.first
    end

    def reset_cache
      @files = nil
      Report.clear_cache(:storage_stats)
    end

    def delete_old
      return unless cleanup_allowed?
      return if (backup_files = files).size <= SiteSetting.maximum_backups

      backup_files[SiteSetting.maximum_backups..-1].each { |file| delete_file(file.filename) }

      reset_cache
    end

    def delete_prior_to_n_days
      window = SiteSetting.remove_older_backups.to_i
      return unless window && window.is_a?(Numeric) && window > 0
      return unless cleanup_allowed?
      files.each do |file|
        delete_file(file.filename) if file.last_modified < Time.now.ago(window.days)
      end
      reset_cache
    end

    def remote?
      fail NotImplementedError
    end

    # @return [BackupFile]
    def file(filename, include_download_source: false)
      fail NotImplementedError
    end

    def delete_file(filename)
      fail NotImplementedError
    end

    def download_file(filename, destination, failure_message = nil)
      fail NotImplementedError
    end

    def upload_file(filename, source_path, content_type)
      fail NotImplementedError
    end

    def generate_upload_url(filename)
      fail NotImplementedError
    end

    def stats
      {
        used_bytes: used_bytes,
        free_bytes: free_bytes,
        count: files.size,
        last_backup_taken_at: latest_file&.last_modified,
      }
    end

    private

    # @return [Array<BackupFile>]
    def unsorted_files
      fail NotImplementedError
    end

    def cleanup_allowed?
      true
    end

    def used_bytes
      files.sum { |file| file.size }
    end

    def free_bytes
      fail NotImplementedError
    end
  end
end
