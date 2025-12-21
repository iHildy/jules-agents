import { Action, ActionPanel, Icon, Keyboard, launchCommand, LaunchType, List } from "@raycast/api";
import { useCachedState } from "@raycast/utils";
import { SessionListItem } from "./components/sessions/SessionListItem";
import { useSessions } from "./jules";
import { SessionState } from "./types";
import { formatRepoName, formatSessionState, groupSessions } from "./utils";

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
      <List.EmptyView
        title="No Sessions Found"
        description="Try changing your filters or launch a new session."
        icon={Icon.EyeDisabled}
        actions={
          <ActionPanel>
            <Action
              title="Launch Session"
              icon={Icon.PlusCircle}
              onAction={() => launchCommand({ name: "launch-session", type: LaunchType.UserInitiated })}
            />
          </ActionPanel>
        }
      />
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
