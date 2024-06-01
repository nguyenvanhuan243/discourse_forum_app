import { tracked } from "@glimmer/tracking";
import Component from "@ember/component";
import { computed } from "@ember/object";
import { dasherize } from "@ember/string";
import { htmlSafe } from "@ember/template";
import PickFilesButton from "discourse/components/pick-files-button";
import { isAudio, isImage, isVideo } from "discourse/lib/uploads";
import UppyUploadMixin from "discourse/mixins/uppy-upload";
import icon from "discourse-common/helpers/d-icon";

export default class FormTemplateFieldUpload extends Component.extend(
  UppyUploadMixin
) {
  @tracked uploadValue;
  @tracked uploadedFiles = [];
  @tracked disabled = this.uploadingOrProcessing;
  @tracked fileUploadElementId = `${dasherize(this.id)}-uploader`;
  @tracked fileInputSelector = `#${this.fileUploadElementId}`;

  type = "composer";

  @computed("uploadingOrProcessing")
  get uploadStatusLabel() {
    return this.uploadingOrProcessing
      ? "form_templates.upload_field.uploading"
      : "form_templates.upload_field.upload";
  }

  /**
   * The validation from PickFilesButton._filesPicked, where acceptedFormatsOverride
   * is validated and displays a message, happens after the upload is complete.
   *
   * Overriding this method allows us to validate the file before the upload
   *
   * @param file
   * @returns {boolean}
   */
  isUploadedFileAllowed(file) {
    // same logic from PickFilesButton._hasAcceptedExtensionOrType
    const fileTypes = this.attributes.file_types;
    const extension = file.name.split(".").pop();

    return (
      !fileTypes ||
      fileTypes.includes(`.${extension}`) ||
      fileTypes.includes(file.type)
    );
  }

  uploadDone(upload) {
    // If re-uploading, clear the existing file if multiple aren't allowed
    if (!this.attributes.allow_multiple && this.uploadValue) {
      this.uploadedFiles = [];
      this.uploadValue = "";
    }

    this.uploadedFiles.pushObject(upload);

    const uploadMarkdown = this.buildMarkdown(upload);
    if (this.uploadValue && this.allowMultipleFiles) {
      // multiple file upload
      this.uploadValue = `${this.uploadValue}\n${uploadMarkdown}`;
    } else {
      // single file upload
      this.uploadValue = uploadMarkdown;
    }
  }

  buildMarkdown(upload) {
    if (isImage(upload.url)) {
      return `![${upload.file_name}|${upload.width}x${upload.height}](${upload.short_url})`;
    }

    if (isAudio(upload.url)) {
      return `![${upload.file_name}|audio](${upload.short_url})`;
    }

    if (isVideo(upload.url)) {
      return `![${upload.file_name}|video](${upload.short_url})`;
    }

    return `[${upload.file_name}|attachment](${upload.short_url}) (${upload.human_filesize})`;
  }

  <template>
    <div class="control-group form-template-field" data-field-type="upload">
      {{#if @attributes.label}}
        <label class="form-template-field__label">
          {{@attributes.label}}
          {{#if @validations.required}}
            {{icon "asterisk" class="form-template-field__required-indicator"}}
          {{/if}}
        </label>
      {{/if}}

      {{#if @attributes.description}}
        <span class="form-template-field__description">
          {{htmlSafe @attributes.description}}
        </span>
      {{/if}}

      <input type="hidden" name={{@id}} value={{this.uploadValue}} />

      <PickFilesButton
        @fileInputClass="form-template-field__upload"
        @fileInputId={{this.fileUploadElementId}}
        @allowMultiple={{@attributes.allow_multiple}}
        @showButton={{true}}
        @onFilesPicked={{true}}
        @icon="upload"
        @label={{this.uploadStatusLabel}}
        @fileInputDisabled={{this.disabled}}
        @acceptedFormatsOverride={{@attributes.file_types}}
        @acceptedFileTypesString={{@attributes.file_types}}
      />

      {{#if this.uploadedFiles}}
        <ul class="form-template-field__uploaded-files">
          {{#each this.uploadedFiles as |file|}}
            <li>
              {{icon "file"}}
              <a
                href={{file.url}}
                target="_blank"
                rel="noopener noreferrer"
              >{{file.file_name}}</a>
              <span>{{file.human_filesize}}</span>
            </li>
          {{/each}}
        </ul>
      {{/if}}
    </div>
  </template>
}
