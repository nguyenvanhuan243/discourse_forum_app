import { action } from "@ember/object";
import { service } from "@ember/service";
import IncomingEmail from "admin/models/incoming-email";
import AdminEmailIncomings from "admin/routes/admin-email-incomings";
import IncomingEmailModal from "../components/modal/incoming-email";

export default class AdminEmailRejectedRoute extends AdminEmailIncomings {
  @service modal;
  status = "rejected";

  @action
  async showIncomingEmail(id) {
    const model = await IncomingEmail.find(id);
    this.modal.show(IncomingEmailModal, { model });
  }
}
