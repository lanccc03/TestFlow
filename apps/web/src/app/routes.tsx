import {
  Activity,
  Clock3,
  FileCode2,
  FileText,
  FolderKanban,
  History,
  Library,
  Network,
  SendToBack,
  Settings2,
  SquareTerminal,
} from 'lucide-react'
import type React from 'react'

import {
  HistoryPage,
  ReportDetailPage,
  ReportListPage,
  TaskPage,
} from '@/features/execution'
import {
  FrameworkConfigPage,
  ScriptListPage,
} from '@/features/scripts'
import {
  CommandLibraryPage,
  ScpTransferPage,
  SshTerminalPage,
} from '@/features/tools'

export type AppRoute = {
  path: string
  label: string
  description: string
  navGroup: 'scripts' | 'execution' | 'tools'
  icon: typeof FolderKanban
  element: React.ReactNode
  navHidden?: boolean
}

export const appRoutes: AppRoute[] = [
  {
    path: '/cases',
    label: '框架用例库',
    description: '从测试框架读取用例名称、描述和测试步骤。',
    navGroup: 'scripts',
    icon: FolderKanban,
    element: <ScriptListPage />,
  },
  {
    path: '/framework-config',
    label: '框架配置',
    description: '读取并替换自动化框架的完整 JSON 配置。',
    navGroup: 'scripts',
    icon: Settings2,
    element: <FrameworkConfigPage />,
  },
  {
    path: '/tasks',
    label: '执行任务',
    description: '查看当前执行任务、实时日志和最近任务状态。',
    navGroup: 'execution',
    icon: Activity,
    element: <TaskPage />,
  },
  {
    path: '/history',
    label: '执行历史',
    description: '查看历史任务、结果和执行日志入口。',
    navGroup: 'execution',
    icon: History,
    element: <HistoryPage />,
  },
  {
    path: '/reports',
    label: '报告详情',
    description: '展示执行报告、任务结果和日志片段。',
    navGroup: 'execution',
    icon: FileText,
    element: <ReportListPage />,
  },
  {
    path: '/reports/:taskId',
    label: '报告详情',
    description: '展示执行报告、任务结果和日志片段。',
    navGroup: 'execution',
    icon: FileText,
    element: <ReportDetailPage />,
    navHidden: true,
  },
  {
    path: '/ssh',
    label: 'SSH 终端',
    description: '连接测试设备并运行辅助命令。',
    navGroup: 'tools',
    icon: SquareTerminal,
    element: <SshTerminalPage />,
  },
  {
    path: '/scp',
    label: 'SCP 文件传输',
    description: '在本机和测试设备之间传输文件。',
    navGroup: 'tools',
    icon: SendToBack,
    element: <ScpTransferPage />,
  },
  {
    path: '/commands',
    label: '命令库',
    description: '维护可复用 SSH 命令和测试辅助命令。',
    navGroup: 'tools',
    icon: Library,
    element: <CommandLibraryPage />,
  },
]

export const navGroups = [
  { id: 'scripts', label: '脚本', icon: FileCode2 },
  { id: 'execution', label: '执行', icon: Clock3 },
  { id: 'tools', label: '工具', icon: Network },
] as const
