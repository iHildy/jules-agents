import { Action, ActionPanel, Form, getPreferenceValues, open, showToast, Toast } from "@raycast/api";
import { FormValidation, showFailureToast, useForm } from "@raycast/utils";
import { SourceDropdown } from "./components/SourceDropdown";
import { createSession } from "./jules";
import { AutomationMode, Preferences } from "./types";
import { refreshMenuBar } from "./utils";

type Values = {
  prompt: string;
  sourceId: string;
  startingBranch?: string;
  requirePlanApproval?: boolean;
  autoCreatePR?: boolean;
};

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();

  const { reset, focus, handleSubmit, itemProps } = useForm<Values>({
    validation: {
      prompt: FormValidation.Required,
      sourceId: FormValidation.Required,
    },
    initialValues: {
      requirePlanApproval: preferences.requirePlanApproval,
      autoCreatePR: preferences.autoCreatePR,
    },
    onSubmit: async (values) => {
      const toast = await showToast({ style: Toast.Style.Animated, title: "Launching Jules Session" });

      try {
        const response = await createSession({
          prompt: values.prompt,
          sourceContext: {
            source: values.sourceId,
            githubRepoContext: values.startingBranch ? { startingBranch: values.startingBranch } : undefined,
          },
          requirePlanApproval: values.requirePlanApproval,
          automationMode: values.autoCreatePR
            ? AutomationMode.AUTO_CREATE_PR
            : AutomationMode.AUTOMATION_MODE_UNSPECIFIED,
        });

        await refreshMenuBar();

        reset();
        focus("prompt");

        toast.style = Toast.Style.Success;
        toast.title = "Launched Jules Session";
        toast.primaryAction = {
          title: "Open in Browser",
          shortcut: { modifiers: ["cmd", "shift"], key: "o" },
          async onAction() {
            await open(response.url);
          },
        };
      } catch (e) {
        await showFailureToast(e, {
          title: "Failed launching Jules session",
        });
      }
    },
  });

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea title="Prompt" placeholder="What should Jules do?" {...itemProps.prompt} />

      <Form.Separator />

      <SourceDropdown
        onSelectionChange={(value) => itemProps.sourceId.onChange?.(value)}
        value={itemProps.sourceId.value}
      />

      <Form.TextField
        title="Starting Branch"
        placeholder="main"
        info="The branch to base the feature branch on. If not provided, the default branch will be used."
        {...itemProps.startingBranch}
      />

      <Form.Separator />

      <Form.Description title="Options" text="Configure how Jules should work" />

      <Form.Checkbox
        label="Require plan approval"
        info="If enabled, Jules will wait for you to approve the plan before starting work."
        {...itemProps.requirePlanApproval}
      />

      <Form.Checkbox
        label="Automatically create a PR"
        info="If enabled, Jules will automatically create a Pull Request when finished."
        {...itemProps.autoCreatePR}
      />
    </Form>
  );
}
