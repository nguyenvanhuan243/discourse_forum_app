import EmberObject from "@ember/object";
import { buildCategoryPanel } from "discourse/components/edit-category-panel";
import discourseComputed from "discourse-common/utils/decorators";

export default buildCategoryPanel("images").extend({
  @discourseComputed("category.uploaded_background.url")
  backgroundImageUrl(uploadedBackgroundUrl) {
    return uploadedBackgroundUrl || "";
  },

  @discourseComputed("category.uploaded_background_dark.url")
  backgroundDarkImageUrl(uploadedBackgroundDarkUrl) {
    return uploadedBackgroundDarkUrl || "";
  },

  @discourseComputed("category.uploaded_logo.url")
  logoImageUrl(uploadedLogoUrl) {
    return uploadedLogoUrl || "";
  },

  @discourseComputed("category.uploaded_logo_dark.url")
  logoImageDarkUrl(uploadedLogoDarkUrl) {
    return uploadedLogoDarkUrl || "";
  },

  actions: {
    logoUploadDone(upload) {
      this._setFromUpload("category.uploaded_logo", upload);
    },

    logoUploadDeleted() {
      this._deleteUpload("category.uploaded_logo");
    },

    logoDarkUploadDone(upload) {
      this._setFromUpload("category.uploaded_logo_dark", upload);
    },

    logoDarkUploadDeleted() {
      this._deleteUpload("category.uploaded_logo_dark");
    },

    backgroundUploadDone(upload) {
      this._setFromUpload("category.uploaded_background", upload);
    },

    backgroundUploadDeleted() {
      this._deleteUpload("category.uploaded_background");
    },

    backgroundDarkUploadDone(upload) {
      this._setFromUpload("category.uploaded_background_dark", upload);
    },

    backgroundDarkUploadDeleted() {
      this._deleteUpload("category.uploaded_background_dark");
    },
  },

  _deleteUpload(path) {
    this.set(
      path,
      EmberObject.create({
        id: null,
        url: null,
      })
    );
  },

  _setFromUpload(path, upload) {
    this.set(
      path,
      EmberObject.create({
        url: upload.url,
        id: upload.id,
      })
    );
  },
});
