import { MainLayout } from "./components/MainLayout";
import { RequestEditor } from "./components/RequestEditor";
import { FolderEditor } from "./components/FolderEditor";
import { ExecutionEditor } from "./components/ExecutionEditor";
import { TabBar } from "./components/TabBar";
import { openTabs, activeTabId, activeProjectName, knownProjects, isInitializing } from "./store";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { UserGuideView } from "./components/UserGuideView";
import { ImportModal } from "./components/ImportModal";
import { CollectionMockEditor } from "./components/CollectionMockEditor";
import { ExternalMockEditor } from "./components/ExternalMockEditor";
import { PromptModal } from "./components/PromptModal";

function App() {
  // Simple "Routing" for separate windows
  const url = new URL(window.location.href);
  const view = url.searchParams.get('view');

  if (view === 'user-guide') {
    return <UserGuideView />;
  }

  if (isInitializing.value) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-base)', color: 'var(--accent-primary)' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Loading cURL-UI...</div>
      </div>
    )
  }

  // If no project is active AND no projects exist, show welcome screen
  if (activeProjectName.value === "Default Project" && knownProjects.value.length === 0) {
    return (
      <>
        <WelcomeScreen />
        <PromptModal />
      </>
    );
  }

  const activeTab = openTabs.value.find(t => t.id === activeTabId.value);

  return (
    <>
      <MainLayout>
        {/* Tab Bar */}
        <TabBar />

        {/* Content Area */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {activeTab ? (
            activeTab.type === 'request' ? (
              <RequestEditor key={activeTab.id} />
            ) : activeTab.type === 'execution' ? (
              <ExecutionEditor key={activeTab.id} />
            ) : activeTab.type === 'collection' ? (
              <CollectionMockEditor key={activeTab.id} />
            ) : activeTab.type === 'external-mock' ? (
              <ExternalMockEditor key={activeTab.id} />
            ) : (
              <FolderEditor key={activeTab.id} />
            )
          ) : (
            <div style={{ padding: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <p>Select a request or folder to get started.</p>
            </div>
          )}
        </div>
        <ImportModal />
      </MainLayout>
      <PromptModal />
    </>
  );
}

export default App;
