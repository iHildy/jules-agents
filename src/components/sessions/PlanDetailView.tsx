import { Action, ActionPanel, Color, Form, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { FormValidation, showFailureToast, useForm } from "@raycast/utils";
import { approvePlan, sendMessage } from "../../jules";
import { Plan, Session, SessionState } from "../../types";
import { CopyIdAction, CopyPlanMarkdownAction, CopyStepDescriptionAction } from "../CopyActions";

export function ApprovePlanAction(props: { session: Session; onApproved?: () => void }) {
  return (
    <Action
      title="Approve Plan"
      icon={{ source: Icon.CheckCircle, tintColor: Color.Green }}
      onAction={async () => {
        try {
          await showToast({ style: Toast.Style.Animated, title: "Approving plan" });
          await approvePlan(props.session.name);
          await showToast({ style: Toast.Style.Success, title: "Plan approved" });
          if (props.onApproved) {
            props.onApproved();
          }
        } catch (e) {
          await showFailureToast(e, { title: "Failed to approve plan" });
        }
      }}
    />
  );
}

export function DeclinePlanAction(props: { session: Session; mutate: () => Promise<void> }) {
  return (
    <Action.Push
      title="Decline Plan"
      icon={{ source: Icon.XMarkCircle, tintColor: Color.Red }}
      target={<DeclinePlanForm session={props.session} mutate={props.mutate} />}
    />
  );
}

function DeclinePlanForm(props: { session: Session; mutate: () => Promise<void> }) {
  const { pop } = useNavigation();
  const { handleSubmit, itemProps } = useForm<{ reason: string }>({
    onSubmit: async (values) => {
      try {
        await showToast({ style: Toast.Style.Animated, title: "Declining plan" });
        await sendMessage(props.session.name, `I decline the plan. Reason: ${values.reason.trim()}`);
        await showToast({ style: Toast.Style.Success, title: "Plan declined" });
        await props.mutate();
        pop();
      } catch (e) {
        await showFailureToast(e, { title: "Failed to decline plan" });
      }
    },
    validation: {
      reason: FormValidation.Required,
    },
  });

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Decline Plan" style={Action.Style.Destructive} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea title="Reason" placeholder="Why are you declining this plan?" {...itemProps.reason} />
    </Form>
  );
}

export function PlanDetailView(props: { plan: Plan; session: Session; mutate: () => Promise<void> }) {
  const { plan, session, mutate } = props;
  const { pop } = useNavigation();

  return (
    <List navigationTitle={`Plan (${plan.steps.length} steps)`} isShowingDetail>
      <List.EmptyView title="No Steps" description="This plan has no steps" icon={Icon.Document} />
      {plan.steps.map((step) => (
        <List.Item
          key={step.id}
          title={step.title}
          accessories={[{ text: `#${(step.index ?? 0) + 1}` }]}
          detail={
            <List.Item.Detail
              markdown={`## ${step.title}\n\n${step.description || "_No description_"}`}
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label
                    title="Step"
                    text={`${(step.index ?? 0) + 1} of ${plan.steps.length}`}
                  />
                  <List.Item.Detail.Metadata.Label title="ID" text={step.id} />
                </List.Item.Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel>
              {session.state === SessionState.AWAITING_PLAN_APPROVAL && (
                <ActionPanel.Section>
                  <ApprovePlanAction
                    session={session}
                    onApproved={() => {
                      mutate();
                      pop();
                    }}
                  />
                  <DeclinePlanAction session={session} mutate={mutate} />
                </ActionPanel.Section>
              )}
              <ActionPanel.Section>
                <CopyIdAction id={step.title} title="Copy Step Title" />
                <CopyStepDescriptionAction content={step.description || ""} />
                <CopyPlanMarkdownAction plan={plan} />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
