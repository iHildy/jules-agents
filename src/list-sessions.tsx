import {
  Action,
  ActionPanel,
  Color,
  Form,
  Icon,
  Keyboard,
  launchCommand,
  LaunchType,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { FormValidation, showFailureToast, useCachedState, useForm } from "@raycast/utils";
import { format } from "date-fns";
import { approvePlan, sendMessage, useSessionActivities, useSessions } from "./jules";
import { Activity, Session, SessionState } from "./types";
import { getSessionAccessories, getStatusIconForSession, groupSessions } from "./utils";

function FollowupInstruction(props: { session: Session }) {
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

function SessionConversation(props: { session: Session }) {
  const { data, isLoading } = useSessionActivities(props.session.name);

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      navigationTitle={`Activity: ${props.session.title || props.session.id}`}
    >
      <List.EmptyView title="No Activity Yet" description="This session hasn't started yet" icon={Icon.SpeechBubble} />
      {data?.map((activity) => (
        <List.Item
          key={activity.id}
          title={getActivityTitle(activity)}
          subtitle={format(new Date(activity.createTime), "HH:mm")}
          detail={<List.Item.Detail markdown={getActivityMarkdown(activity)} />}
        />
      ))}
    </List>
  );
}

function getActivityTitle(activity: Activity): string {
  if (activity.userMessaged) return "User Message";
  if (activity.agentMessaged) return "Agent Message";
  if (activity.planGenerated) return "Plan Generated";
  if (activity.planApproved) return "Plan Approved";
  if (activity.progressUpdated) return activity.progressUpdated.title || "Progress Update";
  if (activity.sessionCompleted) return "Session Completed";
  if (activity.sessionFailed) return "Session Failed: " + activity.sessionFailed.reason;
  return activity.description || "Activity";
}

function getActivityMarkdown(activity: Activity): string {
  let content = "";
  if (activity.userMessaged) content = activity.userMessaged.userMessage;
  else if (activity.agentMessaged) content = activity.agentMessaged.agentMessage;
  else if (activity.planGenerated)
    content = "Plan generated with " + activity.planGenerated.plan.steps.length + " steps.";
  else if (activity.progressUpdated) content = activity.progressUpdated.description;
  else if (activity.sessionFailed) content = activity.sessionFailed.reason;
  else content = activity.description || "";

  if (activity.artifacts && activity.artifacts.length > 0) {
    content += "\n\n### Artifacts\n";
    activity.artifacts.forEach((artifact) => {
      if (artifact.changeSet) {
        content += `\n**Change Set**: ${artifact.changeSet.source}\n`;
        if (artifact.changeSet.gitPatch) {
          content += "\n```diff\n" + artifact.changeSet.gitPatch.unidiffPatch + "\n```\n";
        }
      }
      if (artifact.media) {
        content += `\n![Media](data:${artifact.media.mimeType};base64,${artifact.media.data})\n`;
      }
      if (artifact.bashOutput) {
        content += `\n**Command**: \`${artifact.bashOutput.command}\`\n`;
        content += "\n```\n" + artifact.bashOutput.output + "\n```\n";
      }
    });
  }

  return content;
}

function SessionDetail(props: { session: Session }) {
  const { session } = props;

  const prUrl = session.outputs?.find((o) => o.pullRequest)?.pullRequest?.url;

  return (
    <List.Item.Detail
      markdown={`## Prompt\n\n${session.prompt || "_No prompt_"}`}
      metadata={
        <List.Item.Detail.Metadata>
          {session.title && <List.Item.Detail.Metadata.Label title="Title" text={session.title} />}
          <List.Item.Detail.Metadata.Label title="ID" text={session.id} />
          <List.Item.Detail.Metadata.Label title="State" text={session.state} />
          <List.Item.Detail.Metadata.Separator />
          {prUrl && (
            <>
              <List.Item.Detail.Metadata.Link title="Pull Request" text={prUrl} target={prUrl} />
              <List.Item.Detail.Metadata.Separator />
            </>
          )}
          <List.Item.Detail.Metadata.Label title="Repository" text={session.sourceContext.source} />
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label
            title="Created"
            text={format(new Date(session.createTime), "EEEE d MMMM yyyy 'at' HH:mm")}
          />
        </List.Item.Detail.Metadata>
      }
    />
  );
}

function SessionListItem(props: {
  session: Session;
  mutate: () => Promise<void>;
  isShowingDetail: boolean;
  setIsShowingDetail: (value: boolean) => void;
}) {
  const prUrl = props.session.outputs?.find((o) => o.pullRequest)?.pullRequest?.url;

  return (
    <List.Item
      id={props.session.id}
      key={props.session.id}
      title={props.session.title || props.session.id}
      icon={getStatusIconForSession(props.session)}
      accessories={getSessionAccessories(props.session, {
        hideCreateTime: props.isShowingDetail,
        hideStatus: props.isShowingDetail,
      })}
      detail={<SessionDetail session={props.session} />}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.OpenInBrowser url={props.session.url} title="Open in Browser" />
            {prUrl && (
              <Action.OpenInBrowser
                icon={{ source: "git-pull-request-arrow.svg", tintColor: Color.PrimaryText }}
                title="Open Pull Request"
                url={prUrl}
                shortcut={
                  {
                    macOS: { modifiers: ["cmd", "shift"], key: "return" },
                    windows: { modifiers: ["ctrl", "shift"], key: "return" },
                  } as Keyboard.Shortcut
                }
              />
            )}
          </ActionPanel.Section>
          {props.session.state === SessionState.AWAITING_PLAN_APPROVAL && (
            <ActionPanel.Section>
              <Action
                title="Approve Plan"
                icon={Icon.CheckCircle}
                style={Action.Style.Destructive}
                onAction={async () => {
                  try {
                    await showToast({ style: Toast.Style.Animated, title: "Approving plan" });
                    await approvePlan(props.session.name);
                    await showToast({ style: Toast.Style.Success, title: "Plan approved" });
                    await props.mutate();
                  } catch (e) {
                    await showFailureToast(e, { title: "Failed to approve plan" });
                  }
                }}
              />
            </ActionPanel.Section>
          )}
          <ActionPanel.Section title="Edit">
            <Action
              title="Launch Session"
              icon={Icon.PlusCircle}
              shortcut={Keyboard.Shortcut.Common.New}
              onAction={() => launchCommand({ name: "launch-session", type: LaunchType.UserInitiated })}
            />
            <Action.Push
              icon={Icon.SpeechBubble}
              title="Send Message"
              target={<FollowupInstruction session={props.session} />}
              shortcut={
                {
                  macOS: { modifiers: ["cmd", "shift"], key: "n" },
                  windows: { modifiers: ["ctrl", "shift"], key: "n" },
                } as Keyboard.Shortcut
              }
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="View">
            <Action
              title={props.isShowingDetail ? "Hide Details" : "Show Details"}
              icon={Icon.Sidebar}
              onAction={() => props.setIsShowingDetail(!props.isShowingDetail)}
              shortcut={
                {
                  macOS: { modifiers: ["cmd", "shift"], key: "d" },
                  windows: { modifiers: ["ctrl", "shift"], key: "d" },
                } as Keyboard.Shortcut
              }
            />
            <Action.Push
              icon={Icon.Message}
              title="View Activities"
              target={<SessionConversation session={props.session} />}
              shortcut={
                {
                  macOS: { modifiers: ["cmd", "shift"], key: "v" },
                  windows: { modifiers: ["ctrl", "shift"], key: "v" },
                } as Keyboard.Shortcut
              }
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="Copy">
            <Action.CopyToClipboard
              title="Copy URL"
              content={props.session.url}
              shortcut={Keyboard.Shortcut.Common.Copy}
            />
            <Action.CopyToClipboard
              title="Copy ID"
              content={props.session.id}
              shortcut={Keyboard.Shortcut.Common.CopyName}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  const { data, isLoading, pagination, mutate } = useSessions();
  const [isShowingDetail, setIsShowingDetail] = useCachedState("isShowingDetail", false);

  const { today, yesterday, thisWeek, thisMonth, older } = groupSessions(data);

  return (
    <List
      isLoading={isLoading}
      pagination={pagination}
      isShowingDetail={isShowingDetail}
      actions={
        <ActionPanel>
          <Action
            title="Launch Session"
            icon={Icon.PlusCircle}
            shortcut={Keyboard.Shortcut.Common.New}
            onAction={() => launchCommand({ name: "launch-session", type: LaunchType.UserInitiated })}
          />
        </ActionPanel>
      }
    >
      <List.Section title="Today">
        {today.map((session) => (
          <SessionListItem
            key={session.id}
            session={session}
            mutate={mutate}
            isShowingDetail={isShowingDetail}
            setIsShowingDetail={setIsShowingDetail}
          />
        ))}
      </List.Section>
      <List.Section title="Yesterday">
        {yesterday.map((session) => (
          <SessionListItem
            key={session.id}
            session={session}
            mutate={mutate}
            isShowingDetail={isShowingDetail}
            setIsShowingDetail={setIsShowingDetail}
          />
        ))}
      </List.Section>
      <List.Section title="This Week">
        {thisWeek.map((session) => (
          <SessionListItem
            key={session.id}
            session={session}
            mutate={mutate}
            isShowingDetail={isShowingDetail}
            setIsShowingDetail={setIsShowingDetail}
          />
        ))}
      </List.Section>
      <List.Section title="This Month">
        {thisMonth.map((session) => (
          <SessionListItem
            key={session.id}
            session={session}
            mutate={mutate}
            isShowingDetail={isShowingDetail}
            setIsShowingDetail={setIsShowingDetail}
          />
        ))}
      </List.Section>
      <List.Section title="Older">
        {older.map((session) => (
          <SessionListItem
            key={session.id}
            session={session}
            mutate={mutate}
            isShowingDetail={isShowingDetail}
            setIsShowingDetail={setIsShowingDetail}
          />
        ))}
      </List.Section>
    </List>
  );
}
