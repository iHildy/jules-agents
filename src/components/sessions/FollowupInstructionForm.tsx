import { Action, ActionPanel, Form, useNavigation } from "@raycast/api";
import { FormValidation, showFailureToast, useForm, showToast, Toast } from "@raycast/utils";
import { sendMessage } from "../../jules";
import { Session } from "../../types";

export function FollowupInstructionForm(props: { session: Session }) {
  const { pop } = useNavigation();
  const { handleSubmit, itemProps } = useForm<{ prompt: string }>({
    onSubmit: async (values) => {
      try {
        await showToast({ style: Toast.Style.Animated, title: "Sending message" });
        await sendMessage(props.session.name, values.prompt.trim());
        await showToast({ style: Toast.Style.Success, title: "Message sent" });
        pop();
      } catch (e) {
        await showFailureToast(e, { title: "Failed sending message" });
      }
    },
    validation: {
      prompt: FormValidation.Required,
    },
  });

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Send Message" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea title="Message" placeholder="Send a message to the session..." {...itemProps.prompt} />
    </Form>
  );
}
