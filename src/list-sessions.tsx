import {
  Action,
  ActionPanel,
  AI,
  Color,
  Detail,
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
import { approvePlan, fetchSessionActivities, sendMessage, useSessionActivities, useSessions } from "./jules";
import { Activity, Plan, Session, SessionState } from "./types";
import {
  formatRepoName,
  formatSessionState,
  formatSessionTitle,
  getSessionAccessories,
  getStatusIconForSession,
  groupSessions,
} from "./utils";

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

function ApprovePlanAction(props: { session: Session; onApproved?: () => void }) {
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

function DeclinePlanAction(props: { session: Session; mutate: () => Promise<void> }) {
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

function SessionConversation(props: { session: Session; mutate: () => Promise<void> }) {
  const { data, isLoading } = useSessionActivities(props.session.name);
  const [filter, setFilter] = useCachedState("activityFilter", "all");

  const filteredData = data?.filter((activity) => {
    if (filter === "messages") {
      return activity.userMessaged || activity.agentMessaged;
    }
    if (filter === "artifacts") {
      return activity.artifacts && activity.artifacts.length > 0;
    }
    if (filter === "hide-progress") {
      return !activity.progressUpdated;
    }
    return true;
  });

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      navigationTitle={`Activity: ${props.session.title || props.session.id}`}
      searchBarAccessory={
        <List.Dropdown tooltip="Filter Activities" value={filter} onChange={setFilter}>
          <List.Dropdown.Item title="All Activities" value="all" />
          <List.Dropdown.Section>
            <List.Dropdown.Item title="Messages Only" value="messages" />
            <List.Dropdown.Item title="Artifacts Only" value="artifacts" />
            <List.Dropdown.Item title="Hide Progress Updates" value="hide-progress" />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      <List.EmptyView title="No Activity Yet" description="This session hasn't started yet" icon={Icon.SpeechBubble} />
      {filteredData?.map((activity) => (
        <List.Item
          key={activity.id}
          title={getActivityTitle(activity)}
          subtitle={format(new Date(activity.createTime), "HH:mm")}
          detail={<List.Item.Detail markdown={getActivityMarkdown(activity)} />}
          actions={
            activity.planGenerated ? (
              <ActionPanel>
                <Action.Push
                  title="View Plan"
                  icon={Icon.List}
                  target={
                    <PlanDetailView plan={activity.planGenerated.plan} session={props.session} mutate={props.mutate} />
                  }
                />
                <Action.CopyToClipboard
                  title="Copy Plan as Markdown"
                  content={activity.planGenerated.plan.steps
                    .map((s, i) => `${i + 1}. **${s.title}**\n   ${s.description || ""}`)
                    .join("\n\n")}
                  shortcut={Keyboard.Shortcut.Common.Copy}
                />
              </ActionPanel>
            ) : undefined
          }
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
  if (activity.sessionFailed) return "Session Failed: " + (activity.sessionFailed.reason || "Unknown reason");
  return activity.description || "Activity";
}

function getActivityMarkdown(
  activity: Activity,
  options: { includeFullArtifacts?: boolean } = { includeFullArtifacts: true },
): string {
  let content = "";
  if (activity.userMessaged) content = activity.userMessaged.userMessage || "";
  else if (activity.agentMessaged) content = activity.agentMessaged.agentMessage || "";
  else if (activity.planGenerated) {
    const plan = activity.planGenerated.plan;
    content = `**Plan with ${plan.steps.length} steps:**\n\n`;
    const stepsToShow = plan.steps.slice(0, 4);
    stepsToShow.forEach((step, i) => {
      content += `${i + 1}. ${step.title}\n`;
    });
    if (plan.steps.length > 4) {
      content += `\n_...and ${plan.steps.length - 4} more steps_`;
    }
  } else if (activity.progressUpdated) content = activity.progressUpdated.description || "";
  else if (activity.sessionFailed) content = activity.sessionFailed.reason || "";
  else content = activity.description || "";

  if (activity.artifacts && activity.artifacts.length > 0) {
    content += "\n\n### Artifacts\n";
    activity.artifacts.forEach((artifact) => {
      if (artifact.changeSet) {
        content += `\n**Change Set**: ${artifact.changeSet.source}\n`;
        if (artifact.changeSet.gitPatch) {
          if (options.includeFullArtifacts) {
            content += "\n```diff\n" + artifact.changeSet.gitPatch.unidiffPatch + "\n```\n";
          } else {
            content += "\n_Git patch omitted_\n";
          }
        }
      }
      if (artifact.media) {
        if (options.includeFullArtifacts) {
          content += `\n![Media](data:${artifact.media.mimeType};base64,${artifact.media.data})\n`;
        } else {
          content += `\n_Media artifact (${artifact.media.mimeType}) omitted_\n`;
        }
      }
      if (artifact.bashOutput) {
        content += `\n**Command**: \`${artifact.bashOutput.command}\`\n`;
        if (options.includeFullArtifacts) {
          content += "\n```\n" + artifact.bashOutput.output + "\n```\n";
        } else {
          content += "\n_Command output omitted_\n";
        }
      }
    });
  }

  return content;
}

function PlanDetailView(props: { plan: Plan; session: Session; mutate: () => Promise<void> }) {
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
                <Action.CopyToClipboard
                  title="Copy Step Title"
                  content={step.title}
                  shortcut={Keyboard.Shortcut.Common.Copy}
                />
                <Action.CopyToClipboard title="Copy Step Description" content={step.description || ""} />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
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
          <List.Item.Detail.Metadata.Label title="State" text={formatSessionState(session.state)} />
          <List.Item.Detail.Metadata.Separator />
          {prUrl && <List.Item.Detail.Metadata.Link title="Pull Request" text={prUrl} target={prUrl} />}
          <List.Item.Detail.Metadata.Label title="Repository" text={formatRepoName(session.sourceContext.source)} />
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
              target={<SessionConversation session={props.session} mutate={props.mutate} />}
              shortcut={
                {
                  macOS: { modifiers: ["cmd", "shift"], key: "v" },
                  windows: { modifiers: ["ctrl", "shift"], key: "v" },
                } as Keyboard.Shortcut
              }
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
                            <Action.CopyToClipboard title="Copy Summary" content={summary} />
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
  const [filterStatus, setFilterStatus] = useCachedState("filterStatus", "all");
  const [filterRepo, setFilterRepo] = useCachedState("filterRepo", "all");

  const repositories = Array.from(new Set(data?.map((s) => formatRepoName(s.sourceContext.source)) || [])).sort();

  const filteredData = data?.filter((session) => {
    if (filterStatus !== "all" && session.state !== filterStatus) return false;
    if (filterRepo !== "all" && formatRepoName(session.sourceContext.source) !== filterRepo) return false;
    return true;
  });

  const { today, yesterday, thisWeek, thisMonth, older } = groupSessions(filteredData);

  let dropdownValue = "all:all";
  if (filterStatus !== "all") {
    dropdownValue = `status:${filterStatus}`;
  } else if (filterRepo !== "all") {
    dropdownValue = `repo:${filterRepo}`;
  }

  return (
    <List
      isLoading={isLoading}
      pagination={pagination}
      isShowingDetail={isShowingDetail}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter Sessions"
          value={dropdownValue}
          onChange={(newValue) => {
            const [type, value] = newValue.split(":");
            if (type === "status") {
              setFilterStatus(value);
              setFilterRepo("all");
            } else if (type === "repo") {
              setFilterRepo(value);
              setFilterStatus("all");
            } else {
              setFilterStatus("all");
              setFilterRepo("all");
            }
          }}
        >
          <List.Dropdown.Item title="All Sessions" value="all:all" />
          <List.Dropdown.Section title="Status">
            {Object.values(SessionState).map((state) => (
              <List.Dropdown.Item key={state} title={formatSessionState(state)} value={`status:${state}`} />
            ))}
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Repository">
            {repositories.map((repo) => (
              <List.Dropdown.Item key={repo} title={repo} value={`repo:${repo}`} />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
      actions={
        <ActionPanel>
          <Action
            title="Launch Session"
            icon={Icon.PlusCircle}
            shortcut={Keyboard.Shortcut.Common.New}
            onAction={() => launchCommand({ name: "launch-session", type: LaunchType.UserInitiated })}
          />
          <Action
            title="Refresh Sessions"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={mutate}
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
