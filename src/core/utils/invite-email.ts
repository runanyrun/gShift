export interface SendInviteEmailInput {
  to: string;
  inviteLink: string;
  employeeName: string;
}

export interface InviteEmailSender {
  sendInvite(input: SendInviteEmailInput): Promise<void>;
}

class ConsoleInviteEmailSender implements InviteEmailSender {
  async sendInvite(input: SendInviteEmailInput): Promise<void> {
    console.log(
      `[invite-email] to=${input.to} employee=${input.employeeName} link=${input.inviteLink}`,
    );
  }
}

export const inviteEmailSender: InviteEmailSender = new ConsoleInviteEmailSender();
