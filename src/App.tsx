import { MainLayout } from "./components/MainLayout";
import { RequestEditor } from "./components/RequestEditor";
import { FolderEditor } from "./components/FolderEditor";
import { TabBar } from "./components/TabBar";
import { openTabs, activeTabId } from "./store";

function App() {


  const activeTab = openTabs.value.find(t => t.id === activeTabId.value);

  return (
    <MainLayout>
      {/* Tab Bar */}
      <TabBar />

      {/* Content Area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
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
