import { Panel, Group, Separator } from 'react-resizable-panels'
import { useBootstrap } from '@/hooks/useBootstrap'
import { useSync } from '@/hooks/useSync'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useUIStore } from '@/store/useUIStore'
import { Sidebar } from '@/components/panes/Sidebar'
import { TopNav } from '@/components/panes/TopNav'
import { MainPane } from '@/components/panes/MainPane'
import { DetailPane } from '@/components/panes/DetailPane'

function App() {
  const { error: bootstrapError } = useBootstrap()
  useSync()
  useKeyboardShortcuts()

  const navPinned = useUIStore((s) => s.navPinned)

  return (
    <div className="dark flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Main area: TopNav + resizable panels */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav />

        {/* Spacer when nav is pinned so content isn't hidden behind fixed nav */}
        {navPinned && <div className="h-11 shrink-0" />}

        {bootstrapError && (
          <div className="shrink-0 border-b border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
            Bootstrap error: {bootstrapError}
          </div>
        )}

        <Group orientation="horizontal" id="notocal-panels" className="flex-1">
          <Panel defaultSize={65} minSize={40}>
            <MainPane />
          </Panel>
          <Separator className="w-px bg-border hover:bg-primary/50 transition-colors" />
          <Panel defaultSize={35} minSize={20}>
            <DetailPane />
          </Panel>
        </Group>
      </div>
    </div>
  )
}

export default App
