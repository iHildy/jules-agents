import {
  Action,
  ActionPanel,
  AI,
  Color,
  Detail,
  Icon,
  Keyboard,
  launchCommand,
  LaunchType,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import ViewMedia from "../../view-media";
import { CopyIdAction, CopyPromptAction, CopyPrUrlAction, CopySummaryAction, CopyUrlAction } from "../CopyActions";
import { fetchSessionActivities } from "../../jules";
import { Session, SessionState } from "../../types";
import {
  formatRepoName,
  formatSessionState,
  formatSessionTitle,
  getSessionAccessories,
  getStatusIconForSession,
} from "../../utils";
import { CodeReviewPage } from "./CodeReviewPage";
import { FollowupInstructionForm } from "./FollowupInstructionForm";
import { PlanDetailView } from "./PlanDetailView";
import { SessionConversation, getActivityMarkdown } from "./SessionConversation";
import { ApprovePlanAction, DeclinePlanAction } from "./PlanDetailView";

function SessionDetail(props: { session: Session }) {
  const { session } = props;

  const prUrl = session.outputs?.find((o) => o.pullRequest)?.pullRequest?.url;

  return (
    <List.Item.Detail
      markdown={`## Prompt\n\n${session.prompt || "_No prompt_"}`}
      metadata={
        <List.Item.Detail.Metadata>
          {session.title && <List.Item.Detail.Metadata.Label title="Title" text={session.title} />}
          <List.Item.Detail.Metadata.Label title="State" text={formatSessionState(session.state)} />
          <List.Item.Detail.Metadata.Separator />
          {prUrl && <List.Item.Detail.Metadata.Link title="Pull Request" text={prUrl} target={prUrl} />}
          <List.Item.Detail.Metadata.Label title="Repository" text={formatRepoName(session.sourceContext.source)} />
        </List.Item.Detail.Metadata>
      }
    />
  );
}

export function SessionListItem(props: {
  session: Session;
  mutate: () => Promise<void>;
  isShowingDetail: boolean;
  setIsShowingDetail: (value: boolean) => void;
}) {
  const { push } = useNavigation();
  const prUrl = props.session.outputs?.find((o) => o.pullRequest)?.pullRequest?.url;

  const title = formatSessionTitle(props.session, 75);

  return (
    <List.Item
      id={props.session.id}
      key={props.session.id}
      title={title}
      subtitle={props.isShowingDetail ? undefined : formatRepoName(props.session.sourceContext.source)}
      icon={getStatusIconForSession(props.session)}
      accessories={getSessionAccessories(props.session, {
        hideCreateTime: props.isShowingDetail,
        hideStatus: props.isShowingDetail,
      })}
      detail={<SessionDetail session={props.session} />}
      actions={
        <ActionPanel>
          {props.session.state === SessionState.COMPLETED && (
            <ActionPanel.Section>
              <Action.Push
                title="View Code Review"
                icon={Icon.Code}
                target={<CodeReviewPage session={props.session} />}
              />
            </ActionPanel.Section>
          )}
          {props.session.state === SessionState.AWAITING_PLAN_APPROVAL && (
            <ActionPanel.Section>
              <Action
                title="View Plan"
                icon={Icon.List}
                shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
                onAction={async () => {
                  try {
                    await showToast({ style: Toast.Style.Animated, title: "Fetching plan" });
                    const activities = await fetchSessionActivities(props.session.name);
                    // Find the latest PlanGenerated activity
                    const planActivity = [...activities].reverse().find((a) => a.planGenerated);
                    if (planActivity?.planGenerated) {
                      push(
                        <PlanDetailView
                          plan={planActivity.planGenerated.plan}
                          session={props.session}
                          mutate={props.mutate}
                        />,
                      );
                    } else {
                      await showToast({ style: Toast.Style.Failure, title: "No plan found" });
                    }
                  } catch (e) {
                    await showFailureToast(e, { title: "Failed to load plan" });
                  }
                }}
              />
              <ApprovePlanAction session={props.session} onApproved={props.mutate} />
              <DeclinePlanAction session={props.session} mutate={props.mutate} />
            </ActionPanel.Section>
          )}
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
              target={<FollowupInstructionForm session={props.session} />}
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
              target={<SessionConversation session={props.session} mutate={props.mutate} />}
              shortcut={
                {
                  macOS: { modifiers: ["cmd", "shift"], key: "v" },
                  windows: { modifiers: ["ctrl", "shift"], key: "v" },
                } as Keyboard.Shortcut
              }
            />
            <Action.Push
              icon={Icon.Code}
              title="View Code Review"
              target={<CodeReviewPage session={props.session} />}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            />
            <Action.Push
              icon={Icon.Image}
              title="View Media"
              target={<ViewMedia session={props.session} />}
              shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
            />
            <Action
              title="Summarize Session"
              icon={Icon.Wand}
              onAction={async () => {
                const toast = await showToast({ style: Toast.Style.Animated, title: "Summarizing session" });
                try {
                  const activities = await fetchSessionActivities(props.session.name);
                  if (activities.length > 0) {
                    const content = activities
                      .map((a) => getActivityMarkdown(a, { includeFullArtifacts: false }))
                      .join("\n\n---\n\n");

                    // Raycast AI has a character limit. If it's still too long, we truncate from the beginning
                    // since the most recent activities (at the end) are usually more important for a summary.
                    const MAX_CHARS = 25000;
                    const truncatedContent =
                      content.length > MAX_CHARS
                        ? "... (older activities truncated)\n\n" + content.slice(-MAX_CHARS)
                        : content;

                    const summary = await AI.ask(
                      `Summarize the following session activities of a Jules Agent session. Be concise and highlight the main progress and any issues:\n\n${truncatedContent}`,
                    );
                    push(
                      <Detail
                        navigationTitle="Session Summary"
                        markdown={summary}
                        actions={
                          <ActionPanel>
                            <CopySummaryAction content={summary} />
                          </ActionPanel>
                        }
                      />,
                    );
                    toast.style = Toast.Style.Success;
                    toast.title = "Session summarized";
                  } else {
                    toast.style = Toast.Style.Failure;
                    toast.title = "No activity to summarize";
                  }
                } catch (e) {
                  await showFailureToast(e, { title: "Failed to summarize session" });
                }
              }}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="Copy">
            <CopyUrlAction url={props.session.url} />
            <CopyIdAction id={props.session.id} />
            <CopyPromptAction prompt={props.session.prompt} />
            {prUrl && <CopyPrUrlAction url={prUrl} />}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
