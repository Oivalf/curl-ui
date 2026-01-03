import { MainLayout } from "./components/MainLayout";
import { RequestEditor } from "./components/RequestEditor";
import { FolderEditor } from "./components/FolderEditor";
import { TabBar } from "./components/TabBar";
import { openTabs, activeTabId, activeProjectName, knownProjects, isInitializing } from "./store";
import { WelcomeScreen } from "./components/WelcomeScreen";

function App() {
  if (isInitializing.value) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-base)', color: 'var(--accent-primary)' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Loading Curl UI...</div>
      </div>
    )
  }

  // If no project is active AND no projects exist, show welcome screen
  if (activeProjectName.value === "Default Project" && knownProjects.value.length === 0) {
    return <WelcomeScreen />;
  }

  const activeTab = openTabs.value.find(t => t.id === activeTabId.value);

  return (
    <MainLayout>
      {/* Tab Bar */}
      <TabBar />

      {/* Content Area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {activeTab ? (
          activeTab.type === 'request' ? (
            <RequestEditor key={activeTab.id} />
          ) : (
            <FolderEditor key={activeTab.id} />
          )
        ) : (
          <div style={{ padding: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <p>Select a request or folder to get started.</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default App;
