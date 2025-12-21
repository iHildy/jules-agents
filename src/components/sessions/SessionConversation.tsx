import { Action, ActionPanel, getPreferenceValues, Icon, List } from "@raycast/api";
import { format } from "date-fns";
import { useState } from "react";
import { useSessionActivities } from "../../jules";
import { Activity, Preferences, Session } from "../../types";
import { formatBashOutputMarkdown } from "../../utils";
import { CopyActivityLogAction, CopyMessageAction, CopyPlanMarkdownAction } from "../CopyActions";
import { PlanDetailView } from "./PlanDetailView";

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

export function getActivityMarkdown(
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
        content += formatBashOutputMarkdown(artifact.bashOutput, {
          includeFullOutput: options.includeFullArtifacts,
        });
      }
    });
  }

  return content;
}

export function SessionConversation(props: { session: Session; mutate: () => Promise<void> }) {
  const { data, isLoading } = useSessionActivities(props.session.name);
  const { defaultActivityFilter } = getPreferenceValues<Preferences>();
  const [filter, setFilter] = useState(defaultActivityFilter);

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

  const fullActivityLog = data?.map((a) => getActivityMarkdown(a)).join("\n\n---\n\n") || "";

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      navigationTitle={`Activity: ${props.session.title || props.session.id}`}
      actions={
        <ActionPanel>
          <CopyActivityLogAction content={fullActivityLog} />
        </ActionPanel>
      }
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter Activities"
          value={filter}
          onChange={(newValue) => setFilter(newValue as Preferences["defaultActivityFilter"])}
        >
          <List.Dropdown.Item title="All Activities" value="all" />
          <List.Dropdown.Section>
            <List.Dropdown.Item title="Conversation Only" value="messages" />
            <List.Dropdown.Item title="Results & Files Only" value="artifacts" />
            <List.Dropdown.Item title="Milestones Only" value="hide-progress" />
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
          actions={(() => {
            const messageContent = activity.userMessaged?.userMessage || activity.agentMessaged?.agentMessage;
            if (!activity.planGenerated && !messageContent) return undefined;

            return (
              <ActionPanel>
                {activity.planGenerated && (
                  <ActionPanel.Section>
                    <Action.Push
                      title="View Plan"
                      icon={Icon.List}
                      target={
                        <PlanDetailView
                          plan={activity.planGenerated.plan}
                          session={props.session}
                          mutate={props.mutate}
                        />
                      }
                    />
                    <CopyPlanMarkdownAction plan={activity.planGenerated.plan} />
                  </ActionPanel.Section>
                )}
                {messageContent && (
                  <ActionPanel.Section>
                    <CopyMessageAction content={messageContent} />
                  </ActionPanel.Section>
                )}
              </ActionPanel>
            );
          })()}
        />
      ))}
    </List>
  );
}
